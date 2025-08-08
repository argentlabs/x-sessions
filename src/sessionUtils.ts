import { TypedData } from "@starknet-io/types-js"
import {
  BigNumberish,
  Call,
  byteArray,
  ec,
  hash,
  merkle,
  num,
  selector,
  typedData,
} from "starknet"
import {
  ArgentServiceSignatureResponse,
  OffChainSession,
  OnChainSession,
  SessionKey,
  SignerType,
} from "./session.types"
import { signerTypeToCustomEnum } from "./signerTypeToCustomEnum"
import { ALLOWED_METHOD_HASH } from "./utils"

export const buildMerkleTree = (
  sessionRequest: OffChainSession,
): merkle.MerkleTree => {
  const leaves = sessionRequest.allowed_methods.map((method) =>
    hash.computePoseidonHashOnElements([
      ALLOWED_METHOD_HASH,
      method["Contract Address"],
      selector.getSelectorFromName(method.selector),
    ]),
  )
  return new merkle.MerkleTree(leaves, hash.computePoseidonHash)
}

export const compileSessionHelper = (
  sessionRequest: OffChainSession,
): OnChainSession => {
  const bArray = byteArray.byteArrayFromString(
    sessionRequest.metadata as string,
  )
  const elements = [
    bArray.data.length,
    ...bArray.data,
    bArray.pending_word,
    bArray.pending_word_len,
  ]
  const metadataHash = hash.computePoseidonHashOnElements(elements)

  const session = {
    expires_at: sessionRequest.expires_at,
    allowed_methods_root: buildMerkleTree(sessionRequest).root.toString(),
    metadata_hash: metadataHash,
    session_key_guid: sessionRequest.session_key_guid,
  }
  return session
}

export const getSessionProofs = (
  sessionRequest: OffChainSession,
  calls: Call[],
): string[][] => {
  const tree = buildMerkleTree(sessionRequest)

  return calls.map((call) => {
    const allowedIndex = sessionRequest.allowed_methods.findIndex(
      (allowedMethod) => {
        const checkEntrypoint = /^0x[0-9a-fA-F]+$/.test(call.entrypoint)
          ? selector.getSelectorFromName(allowedMethod.selector) ==
            call.entrypoint
          : allowedMethod.selector == call.entrypoint

        return (
          num.hexToDecimalString(allowedMethod["Contract Address"]) ===
            num.hexToDecimalString(call.contractAddress) && checkEntrypoint
        )
      },
    )

    return tree.getProof(tree.leaves[allowedIndex], tree.leaves)
  })
}

const getStarknetSignatureType = (
  pubkey: BigNumberish,
  signature: bigint[],
) => {
  return signerTypeToCustomEnum(SignerType.Starknet, {
    pubkey,
    r: signature[0],
    s: signature[1],
  })
}

export const compileSessionTokenHelper = async (
  session: OnChainSession,
  sessionRequest: OffChainSession,
  sessionKey: SessionKey,
  calls: Call[],
  sessionSignature: bigint[],
  session_authorization: string[],
  guardianSignature: ArgentServiceSignatureResponse,
  cache_authorization: boolean,
) => {
  return {
    session,
    cache_authorization,
    session_authorization,
    sessionSignature: getStarknetSignatureType(
      sessionKey.publicKey,
      sessionSignature,
    ),
    guardianSignature: getStarknetSignatureType(guardianSignature.publicKey, [
      guardianSignature.r,
      guardianSignature.s,
    ]),
    proofs: getSessionProofs(sessionRequest, calls),
  }
}

export const signTxAndSession = (
  transactionHash: string,
  accountAddress: string,
  sessionTypedData: TypedData,
  cacheAuthorisation: boolean,
  sessionKey: SessionKey,
): bigint[] => {
  const sessionMessageHash = typedData.getMessageHash(
    sessionTypedData,
    accountAddress,
  )

  const sessionWithTxHash = hash.computePoseidonHashOnElements([
    transactionHash,
    sessionMessageHash,
    +cacheAuthorisation,
  ])

  const signature = ec.starkCurve.sign(sessionWithTxHash, sessionKey.privateKey)
  return [signature.r, signature.s]
}
