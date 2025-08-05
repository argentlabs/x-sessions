import {
  ArraySignatureType,
  Call,
  InvocationsSignerDetails,
  ProviderInterface,
  PaymasterRpc,
} from "starknet"
import { Session } from "./session.types"
import { Network } from "./outsideExecution.types"

export interface GetAccountWithSessionSignerParams {
  provider: ProviderInterface
  session: Session
  cacheAuthorisation?: boolean
  paymasterRpc?: PaymasterRpc
}

export interface GetSessionSignatureForTransactionParams {
  sessionAuthorizationSignature: ArraySignatureType
  session: Session
  transactionHash: string
  calls: Call[]
  accountAddress: string
  invocationSignerDetails: InvocationsSignerDetails
  cacheAuthorisation: boolean
  network?: Network
}
