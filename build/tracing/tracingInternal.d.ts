import { ProviderRpcClient } from "everscale-inpage-provider";
import { AllowedCodes, MsgTree, OptionalContracts, TraceParams } from "./types";
import { Factory } from "../factory";
export declare class TracingInternal<Abi = any> {
    private readonly ever;
    private readonly factory;
    private readonly endPoint;
    private readonly enabled;
    private readonly consoleContract;
    private _allowedCodes;
    constructor(ever: ProviderRpcClient, factory: Factory<any>, endPoint: string, enabled?: boolean);
    get allowedCodes(): AllowedCodes;
    setAllowCodes(allowedCodes?: OptionalContracts): void;
    allowCodesForAddress(address: string, allowedCodes?: OptionalContracts): void;
    removeAllowedCodesForAddress(address: string, allowedCodes?: OptionalContracts): void;
    removeAllowedCodes(allowedCodes?: OptionalContracts): void;
    trace({ inMsgId, allowedCodes, }: TraceParams): Promise<MsgTree | undefined>;
    private printConsoleMsg;
    private buildMsgTree;
    private buildTracingTree;
    private findRevertedBranch;
    private depthSearch;
}
