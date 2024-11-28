import {
  ArraySignatureType,
  BigNumberish,
  CairoCustomEnum,
  Calldata,
  ProviderInterface,
  Signature,
  constants,
} from "starknet"

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
  projectSignature?: Signature
}

export type CreateSessionParams = {
  sessionKey: SessionKey
  allowedMethods: AllowedMethod[]
  expiry: bigint
  metaData: SessionMetadata
}

export type SessionKey = {
  publicKey: string
  privateKey: Uint8Array
}

export type BuildSessionAccountParams = {
  session: Session
  sessionKey: SessionKey
  provider: ProviderInterface
  useCacheAuthorisation?: boolean
  argentSessionServiceBaseUrl?: string
}

export type ArgentServiceSignatureResponse = {
  publicKey: string // Public address of a guardian (cosigner)
  r: bigint
  s: bigint
}

export type ArgentServiceSessionBody = {
  sessionHash: string
  sessionAuthorisation: ArraySignatureType
  cacheAuthorisation?: boolean
  sessionSignature: {
    type: string
    signer: {
      publicKey: string
      r: string
      s: string
    }
  }
}

export type ArgentServiceSessionTxV1Body = {
  contractAddress: string
  calldata: Calldata
  maxFee: string
  nonce: string
  version: string
  chainId: string
}

export type ArgentServiceSessionTxV3Body = {
  sender_address: string
  calldata: Calldata
  nonce: string
  version: string
  chain_id: string
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

export type ArgentServiceSignSessionBody = {
  session: ArgentServiceSessionBody
  transaction?: ArgentServiceSessionTxV1Body | ArgentServiceSessionTxV3Body
}

export interface Session {
  sessionKeyGuid: BigNumberish
  hash: BigNumberish
  version: string
  address: string
  chainId: constants.StarknetChainId
  expiresAt: BigNumberish
  allowedMethods: AllowedMethod[]
  metadata: string
  authorisationSignature: Signature
  sessionKey: SessionKey
}

export interface VerifySessionParams {
  session: Session
  sessionKey: SessionKey
}
