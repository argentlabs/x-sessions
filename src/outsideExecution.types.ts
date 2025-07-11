import { Session, SessionKey } from "./session.types"
import {
  ArraySignatureType,
  BigNumberish,
  Call,
  RawArgs,
  TypedData,
} from "starknet"

export type Network = "mainnet" | "sepolia"

export interface OutsideExecution {
  caller: string
  nonce: BigNumberish
  execute_after: BigNumberish
  execute_before: BigNumberish
  calls: OutsideCall[]
}

export interface OutsideCall {
  to: string
  selector: BigNumberish
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
  network?: Network
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
  network?: Network
}

export interface SignOutsideExecutionParams {
  session: Session
  sessionKey: SessionKey
  argentSessionServiceUrl: string
  outsideExecutionTypedData: TypedData
  cacheAuthorisation?: boolean
  calls: Call[]
  network?: Network
}
