import {
  ArraySignatureType,
  Call,
  InvocationsSignerDetails,
  Signer,
} from "starknet"

class SessionSigner extends Signer {
  constructor(
    private signTransactionCallback: (
      calls: Call[],
      invocationSignerDetails: InvocationsSignerDetails,
    ) => Promise<ArraySignatureType>,
  ) {
    super()
  }

  public async signRaw(_: string): Promise<string[]> {
    throw new Error("Method not implemented.")
  }

  public async signTransaction(
    calls: Call[],
    invocationSignerDetails: InvocationsSignerDetails,
  ): Promise<ArraySignatureType> {
    return this.signTransactionCallback(calls, invocationSignerDetails)
  }
}

export { SessionSigner }
