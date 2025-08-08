import {
  ArraySignatureType,
  Call,
  InvocationsSignerDetails,
  Signer,
  type Signature,
  type TypedData,
} from "starknet"
export { sign } from "@scure/starknet"

class SessionSigner extends Signer {
  constructor(
    private signTransactionCallback: (
      calls: Call[],
      invocationSignerDetails: InvocationsSignerDetails,
    ) => Promise<ArraySignatureType>,
    private signMessageCallback: (typedData: TypedData) => Promise<Signature>,
  ) {
    super()
  }

  public async signRaw(_: string): Promise<string[]> {
    throw new Error("Method not implemented.")
  }

  public async signMessage(
    typedData: TypedData,
    _: string,
  ): Promise<Signature> {
    return this.signMessageCallback(typedData)
  }

  public async signTransaction(
    calls: Call[],
    invocationSignerDetails: InvocationsSignerDetails,
  ): Promise<ArraySignatureType> {
    return this.signTransactionCallback(calls, invocationSignerDetails)
  }
}

export { SessionSigner }
