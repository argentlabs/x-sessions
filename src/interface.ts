import { BigNumberish, Call } from "starknet"
import { ETransactionVersion } from "starknet-types"

export type OffchainSessionDetails = {
  nonce: BigNumberish
  maxFee: BigNumberish | undefined
  version: `${ETransactionVersion}`
}

export type OffchainSessionCall = Call & {
  offchainSessionDetails?: OffchainSessionDetails
}

export interface OffchainSessionAddInvokeTransactionParameters {
  calls: OffchainSessionCall[]
}
