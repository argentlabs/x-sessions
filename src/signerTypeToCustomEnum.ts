import { CairoCustomEnum } from "starknet"
import { SignerType } from "./types"

const signerTypeToCustomEnum = (
  signerType: SignerType,
  value: any,
): CairoCustomEnum => {
  const contents = {
    Starknet: undefined,
    Secp256k1: undefined,
    Secp256r1: undefined,
    Eip191: undefined,
    Webauthn: undefined,
  }

  if (signerType === SignerType.Starknet) {
    contents.Starknet = value
  } else if (signerType === SignerType.Secp256k1) {
    contents.Secp256k1 = value
  } else if (signerType === SignerType.Secp256r1) {
    contents.Secp256r1 = value
  } else if (signerType === SignerType.Eip191) {
    contents.Eip191 = value
  } else if (signerType === SignerType.Webauthn) {
    contents.Webauthn = value
  } else {
    throw new Error(`Unknown SignerType`)
  }

  return new CairoCustomEnum(contents)
}

export { signerTypeToCustomEnum }
