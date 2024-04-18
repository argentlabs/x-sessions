import { BigNumberish, CairoCustomEnum } from "starknet"

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
