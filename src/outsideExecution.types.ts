import { Session, SessionKey } from "dist/sessionTypes"
import {
  ArraySignatureType,
  BigNumberish,
  Call,
  num,
  RawArgs,
  TypedData,
} from "starknet"

export interface OutsideExecution {
  caller: string
  nonce: num.BigNumberish
  execute_after: num.BigNumberish
  execute_before: num.BigNumberish
  calls: OutsideCall[]
}

export interface OutsideCall {
  to: string
  selector: num.BigNumberish
  calldata: RawArgs
}

export type OutsideExecutionTypedDataResponse = {
  signature: ArraySignatureType
  outsideExecutionTypedData: TypedData
}

export interface OutsideExecutionParams {
  caller?: string
  execute_after?: BigNumberish
  execute_before?: BigNumberish
  nonce?: BigNumberish
  version?: string
}

export interface CreateOutsideExecutionCallParams {
  session: Session
  sessionKey: SessionKey
  argentSessionServiceUrl?: string
  cacheAuthorisation?: boolean
  calls: Call[]
  outsideExecutionParams?: OutsideExecutionParams
}

export interface BuildOutsideExecutionTypedDataParams {
  outsideExecution: OutsideExecution
  chainId: string
  version?: string
}

export interface CreateOutsideExecutionTypedData {
  session: Session
  sessionKey: SessionKey
  argentSessionServiceUrl?: string
  cacheAuthorisation?: boolean
  calls: Call[]
  outsideExecutionParams?: OutsideExecutionParams
}

export interface SignOutsideExecutionParams {
  session: Session
  sessionKey: SessionKey
  argentSessionServiceUrl: string
  outsideExecutionTypedData: TypedData
  cacheAuthorisation?: boolean
  calls: Call[]
}
