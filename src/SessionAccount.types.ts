import {
  ArraySignatureType,
  Call,
  InvocationsSignerDetails,
  ProviderInterface,
} from "starknet"
import { Session } from "./session.types"

export interface GetAccountWithSessionSignerParams {
  provider: ProviderInterface
  session: Session
  cacheAuthorisation?: boolean
}

export interface GetSessionSignatureForTransactionParams {
  sessionAuthorizationSignature: ArraySignatureType
  session: Session
  transactionHash: string
  calls: Call[]
  accountAddress: string
  invocationSignerDetails: InvocationsSignerDetails
  cacheAuthorisation: boolean
}
