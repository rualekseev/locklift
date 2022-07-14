import { Trace } from "./trace/trace";
import { Optional } from "../types";

export enum TraceType {
  FUNCTION_CALL = "function_call",
  FUNCTION_RETURN = "function_return",
  DEPLOY = "deploy",
  EVENT = "event",
  EVENT_OR_FUNCTION_RETURN = "event_or_return",
  BOUNCE = "bounce",
  TRANSFER = "transfer",
}

export type MsgTree = {
  outMessages: Array<any>;
  dst_transaction: any;
  dst: string;
  msg_type: number;
  body: string;
  bounce: boolean;
  bounced: boolean;
  code_hash: string;
  src: string;
  value: number;
  id: string;
  dst_account?: {
    id: string;
    code_hash: string;
  };
  src_account?: {
    id: string;
    code_hash: string;
  };
};

export type RevertedBranch<Abi = unknown> = { totalActions: number; traceLog: Trace<Abi>; actionIdx: number };
export type TraceParams = {
  inMsgId: string;
  allowedCodes?: AllowedCodes;
};
export type OptionalContracts = Optional<AllowedCodes, "contracts">;
type AllowedCode = {
  compute: Array<number | null>;
  action: Array<number | null>;
};
export type AllowedCodes = AllowedCode & {
  contracts: Record<string, AllowedCode>;
};
