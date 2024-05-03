import {
  Account,
  ArraySignatureType,
  BigNumberish,
  CairoCustomEnum,
  Calldata,
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
  cache_authorization?: boolean
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
  cacheAuthorization?: boolean
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

export type BackendSessionBody = {
  sessionHash: string
  sessionAuthorisation: ArraySignatureType
  sessionSignature: {
    type: string
    signer: {
      publicKey: string
      r: string
      s: string
    }
  }
}

export type BackendSessionTxV1Body = {
  contractAddress: string
  calldata: Calldata
  maxFee: string
  nonce: string
  version: string
  chainId: string
}

export type BackendSessionTxV3Body = {
  sender_address: string
  calldata: Calldata
  nonce: string
  version: string
  chainId: string
  resource_bounds: {
    l1_gas: {
      max_amount: string
      max_price_per_unit: string
    }
    l2_gas: {
      max_amount: string
      max_price_per_unit: string
    }
  }
  tip: string
  paymaster_data: string[]
  account_deployment_data: BigNumberish[]
  nonce_data_availability_mode: string
  fee_data_availability_mode: string
}

export type BackendSignSessionBody = {
  session: BackendSessionBody
  transaction?: BackendSessionTxV1Body | BackendSessionTxV3Body
}
