import {CONSOLE_ADDRESS} from "../constants";
import {AllowedCodes, DecodedMsg, MessageTree, TraceContext, TraceType} from "../types";
import {Address} from "everscale-inpage-provider";

import {ContractWithName} from "../../../types";
import {contractInformation, decoder, isErrorExistsInAllowedArr} from "./utils";
import {TracingInternal} from "../tracingInternal";

export class Trace<Abi = any> {
  outTraces: Array<Trace> = [];
  error: null | { phase: "compute" | "action"; code: number; ignored?: boolean } = null;

  type: TraceType | null = null;
  contract!: ContractWithName;
  decodedMsg: DecodedMsg | undefined = undefined;
  hasErrorInTree = false;
  constructor(
    private readonly tracing: TracingInternal,
    readonly msg: MessageTree,
    private readonly srcTrace: Trace | null,
    private readonly context: TraceContext
  ) {}

  async buildTree(
    allowedCodes: AllowedCodes = { compute: [], action: [], contracts: { any: { compute: [], action: [] } } },
    contractGetter: (codeHash: string, address: Address) => ContractWithName<Abi> | undefined,
  ) {
    this.setMsgType();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { codeHash, address } = contractInformation({ msg: this.msg, type: this.type!, ctx: this.context});
    const contract = contractGetter(codeHash || "", new Address(address));

    this.checkForErrors(allowedCodes);
    await this.decode(contract);
    for (const msg of this.msg.outMessages) {
      const trace = new Trace(this.tracing, msg, this, this.context);
      await trace.buildTree(allowedCodes, contractGetter);
      if (trace.hasErrorInTree) {
        this.hasErrorInTree = true;
      }
      this.outTraces.push(trace);
    }
  }

  // allowed_codes - {compute: [100, 50, 12], action: [11, 12]}
  checkForErrors(
    allowedCodes: AllowedCodes = { compute: [], action: [], contracts: { any: { compute: [], action: [] } } },
  ) {
    const tx = this.msg.dstTransaction;

    if (this.msg.dst === CONSOLE_ADDRESS) {
      return;
    }

    let skipComputeCheck = false;
    if (tx && (tx.compute.success || tx.compute.status === "skipped") && !tx.aborted) {
      skipComputeCheck = true;
    }
    let skipActionCheck = false;
    if (tx && tx.action && tx.action.success) {
      skipActionCheck = true;
    }

    // error occured during compute phase
    if (!skipComputeCheck && tx && tx.compute.exitCode !== 0) {
      this.error = { phase: "compute", code: tx.compute.exitCode };
      // we didnt expect this error, save error
      if (
        isErrorExistsInAllowedArr(allowedCodes.compute, tx.compute.exitCode) ||
        isErrorExistsInAllowedArr(allowedCodes.contracts?.[this.msg.dst]?.compute, tx.compute.exitCode)
      ) {
        this.error.ignored = true;
      }
    } else if (!skipActionCheck && tx && tx.action && tx.action.resultCode !== 0) {
      this.error = { phase: "action", code: tx.action.resultCode };
      // we didnt expect this error, save error
      if (
        isErrorExistsInAllowedArr(allowedCodes.action, tx.action.resultCode) ||
        isErrorExistsInAllowedArr(allowedCodes.contracts?.[this.msg.dst]?.action, tx.action.resultCode)
      ) {
        this.error.ignored = true;
      }
    }
    if (this.error && !this.error.ignored) {
      this.hasErrorInTree = true;
    }
  }

  async decodeMsg(contract: ContractWithName | null = null): Promise<
    | {
        decoded: DecodedMsg;
        finalType: TraceType | null;
      }
    | undefined
  > {
    if (contract === null) {
      contract = this.contract;
    }

    if (this.msg.dst === CONSOLE_ADDRESS) {
      return;
    }

    if (this.type === TraceType.TRANSFER || this.type === TraceType.BOUNCE) {
      return;
    }

    if (this.type === TraceType.FUNCTION_CALL && this.srcTrace) {
      // this is responsible callback with answerId = 0, we cant decode it, however contract doesnt need it too
      // TODO: check
      // @ts-ignore
      if (this.srcTrace.decodedMsg && this.srcTrace.decodedMsg.value?.answerId === "0") {
        return;
      }
    }

    // function call, but we dont have contract here => we cant decode msg
    if (this.type === TraceType.FUNCTION_CALL && !contract) {
      return;
    }

    // 60 error on compute phase - wrong function id. We cant decode this msg with contract abi
    if (this.error && this.error.phase === "compute" && this.error.code === 60) {
      return;
    }

    if (!contract) {
      return;
    }

    return await decoder({
      msgBody: this.msg.body,
      msgType: this.msg.msgType,
      contract,
      initialType: this.type,
    });
  }

  async decode(contract: ContractWithName<Abi> | undefined) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.contract = contract!;
    const decoded = await this.decodeMsg(contract);
    if (decoded) {
      this.type = decoded.finalType;
      this.decodedMsg = decoded.decoded;
    }
  }

  setMsgType() {
    switch (this.msg.msgType) {
      // internal - deploy or function call or bound or transfer
      case "IntMsg":
        // code hash is presented, deploy
        if (this.msg.init?.codeHash !== undefined) {
          this.type = TraceType.DEPLOY;
          // bounced msg
        } else if (this.msg.bounced) {
          this.type = TraceType.BOUNCE;
          // empty body, just transfer
        } else if (this.msg.body === undefined) {
          this.type = TraceType.TRANSFER;
        } else {
          this.type = TraceType.FUNCTION_CALL;
        }
        return;
      // extIn - deploy or function call
      case "ExtIn":
        if (this.msg.init?.codeHash !== undefined) {
          this.type = TraceType.DEPLOY;
        } else {
          this.type = TraceType.FUNCTION_CALL;
        }
        return;
      // extOut - event or return
      case "ExtOut":
        // if this msg was produced by extIn msg, this can be return or event
        if (this.srcTrace !== null && this.srcTrace.msg.msgType === "ExtIn") {
          this.type = TraceType.EVENT_OR_FUNCTION_RETURN;
        } else {
          this.type = TraceType.EVENT;
        }
        return;
      default:
        return;
    }
  }
}
