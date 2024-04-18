import {
  Call,
  InvocationsSignerDetails,
  RPC,
  V2InvocationsSignerDetails,
  ec,
  hash,
  transaction,
  typedData,
} from "starknet"

import { OffChainSession } from "./hybridSessionTypes"

// TODO: refactor with backend new endpoints
export class ArgentBackendService {
  // TODO We might want to update this to support KeyPair instead of StarknetKeyPair?
  // Or that backend becomes: "export class BackendService extends KeyPair {", can also extends RawSigner ?
  constructor(
    public sessionTypedData: any,
    public backendKey: any,
  ) {}

  // TODO: remove and replace with backend endpoint
  public async signTxAndSession(
    calls: Call[],
    transactionsDetail: InvocationsSignerDetails,
    sessionTokenToSign: OffChainSession,
  ): Promise<bigint[]> {
    // verify session param correct
    // extremely simplified version of the backend verification
    // backend must check, timestamps fees, used tokens nfts...
    const allowed_methods = sessionTokenToSign.allowed_methods
    if (
      !calls.every((call) => {
        return allowed_methods.some(
          (method) =>
            method["Contract Address"] === call.contractAddress &&
            method.selector === call.entrypoint,
        )
      })
    ) {
      throw new Error("Call not allowed by backend")
    }

    const compiledCalldata = transaction.getExecuteCalldata(
      calls,
      transactionsDetail.cairoVersion,
    )
    let msgHash
    if (
      Object.values(RPC.ETransactionVersion2).includes(
        transactionsDetail.version as any,
      )
    ) {
      const det = transactionsDetail as V2InvocationsSignerDetails
      msgHash = hash.calculateInvokeTransactionHash({
        ...det,
        senderAddress: det.walletAddress,
        compiledCalldata,
        version: det.version,
      })
    } else if (
      Object.values(RPC.ETransactionVersion3).includes(
        transactionsDetail.version as any,
      )
    ) {
      throw Error("not implemented")
    } else {
      throw Error("unsupported signTransaction version")
    }

    const sessionMessageHash = typedData.getMessageHash(
      this.sessionTypedData,
      transactionsDetail.walletAddress,
    )
    const sessionWithTxHash = hash.computePoseidonHash(
      msgHash,
      sessionMessageHash,
    )
    const signature = ec.starkCurve.sign(sessionWithTxHash, this.backendKey)
    return [signature.r, signature.s]
  }

  /* public async signOutsideTxAndSession(
    calls: Call[],
    sessionTokenToSign: OffChainSession,
    accountAddress: string,
    outsideExecution: OutsideExecution,
    revision: TypedDataRevision,
  ): Promise<bigint[]> {
    // TODO backend must verify, timestamps fees, used tokens nfts...
    const currentTypedData = getTypedData(
      outsideExecution,
      await provider.getChainId(),
      revision,
    )
    const messageHash = typedData.getMessageHash(
      currentTypedData,
      accountAddress,
    )

    const sessionMessageHash = typedData.getMessageHash(
      await getSessionTypedData(sessionTokenToSign),
      accountAddress,
    )
    const sessionWithTxHash = hash.computePoseidonHash(
      messageHash,
      sessionMessageHash,
    )
    const signature = ec.starkCurve.sign(
      sessionWithTxHash,
      num.toHex(this.backendKey.privateKey),
    )
    return [signature.r, signature.s]
  } */
}
