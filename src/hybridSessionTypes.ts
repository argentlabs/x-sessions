import {
  Account,
  BigNumberish,
  CairoCustomEnum,
  ProviderInterface,
} from "starknet"
import { StarknetWindowObject } from "starknet-types"

export enum SignerType {
  Starknet,
  Secp256k1,
  Secp256r1,
  Eip191,
  Webauthn,
}

export interface AllowedMethod {
  "Contract Address": string
  selector: string
}

export interface OffChainSession {
  expires_at: BigNumberish
  allowed_methods: AllowedMethod[]
  metadata: string
  session_key_guid: BigNumberish
}

export interface OnChainSession {
  expires_at: BigNumberish
  allowed_methods_root: string
  metadata_hash: string
  session_key_guid: BigNumberish
}

export interface SessionToken {
  session: OnChainSession
  session_authorization: string[]
  session_signature: CairoCustomEnum
  guardian_signature: CairoCustomEnum
  proofs: string[][]
}

// When rpc spec will become the standard, this can be removed
export type CreateSessionOptions = {
  useWalletRequestMethods?: boolean
}

export type MetadataTxFee = {
  tokenAddress: string
  maxAmount: string
}

export type SessionMetadata = {
  projectID: string
  txFees: MetadataTxFee[]
}

export type SessionParams = {
  dappKey?: Uint8Array
  allowedMethods: AllowedMethod[]
  expiry: bigint
  metaData: SessionMetadata
}

export type CreateSessionParams = {
  provider: ProviderInterface
  account: Account
  sessionParams: SessionParams
  wallet?: StarknetWindowObject
  options?: CreateSessionOptions
}

export type BackendSignatureResponse = {
  publicKey: string // Public address of a guardian (cosigner)
  r: bigint
  s: bigint
}
