import { BigNumberish, Call, types } from "starknet"

export type OffchainSessionDetails = {
  nonce: BigNumberish
  maxFee: BigNumberish | undefined
  version: `${types.RPC.ETransactionVersion}`
}

export type OffchainSessionCall = Call & {
  offchainSessionDetails?: OffchainSessionDetails
}

export interface OffchainSessionAddInvokeTransactionParameters {
  calls: OffchainSessionCall[]
}
