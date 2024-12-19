import { StarknetDomain, TypedData } from "@starknet-io/types-js"
import {
  Account,
  constants,
  ec,
  encode,
  hash,
  shortString,
  Signature,
  typedData,
} from "starknet"
import { SessionAccount } from "./SessionAccount"
import {
  AllowedMethod,
  BuildSessionAccountParams,
  CreateSessionParams,
  OffChainSession,
  Session,
  SessionKey,
  SessionMetadata,
  VerifySessionParams,
} from "./session.types"

const sessionTypes = {
  StarknetDomain: [
    { name: "name", type: "shortstring" },
    { name: "version", type: "shortstring" },
    { name: "chainId", type: "shortstring" },
    { name: "revision", type: "shortstring" },
  ],
  "Allowed Method": [
    { name: "Contract Address", type: "ContractAddress" },
    { name: "selector", type: "selector" },
  ],
  Session: [
    { name: "Expires At", type: "timestamp" },
    { name: "Allowed Methods", type: "merkletree", contains: "Allowed Method" },
    { name: "Metadata", type: "string" },
    { name: "Session Key", type: "felt" },
  ],
}

export const ALLOWED_METHOD_HASH = typedData.getTypeHash(
  sessionTypes,
  "Allowed Method",
  typedData.TypedDataRevision.ACTIVE,
)

// WARNING! Revision is encoded as a number in the StarkNetDomain type and not as shortstring
// This is due to a bug in the Braavos implementation, and has been kept for compatibility
const getSessionDomain = (
  chainId: constants.StarknetChainId,
): StarknetDomain => ({
  name: "SessionAccount.session",
  version: shortString.encodeShortString("1"),
  chainId,
  revision: "1",
})

const getSessionTypedData = (
  sessionRequest: OffChainSession,
  chainId: constants.StarknetChainId,
): TypedData => ({
  types: sessionTypes,
  primaryType: "Session",
  domain: getSessionDomain(chainId),
  message: {
    "Expires At": sessionRequest.expires_at,
    "Allowed Methods": sessionRequest.allowed_methods,
    Metadata: sessionRequest.metadata,
    "Session Key": sessionRequest.session_key_guid,
  },
})

const createOffchainSession = (
  allowed_methods: AllowedMethod[],
  expires_at: bigint,
  metadata: SessionMetadata,
  signerPublicKey: string,
): OffChainSession => ({
  expires_at: Number(expires_at),
  allowed_methods,
  metadata: JSON.stringify(metadata),
  session_key_guid: hash.computePoseidonHash(
    shortString.encodeShortString("Starknet Signer"),
    signerPublicKey,
  ),
})

/**
 * Builds a session account using the provided session and session key.
 * @param {Object} params - The parameters for building the session account.
 * @param {Session} params.session - The session created by the dapp.
 * @param {SessionKey} params.sessionKey - The session key generated by the dapp.
 * @param {Provider} params.provider - The RPC provider.
 * @param {string} params.argentSessionServiceBaseUrl - The base URL of the Argent session service.
 * @param {boolean} params.useCacheAuthorisation - Whether to use cache authorisation.
 * @returns {Promise<Account>} A promise that resolves to the session account.
 */
const buildSessionAccount = async ({
  session,
  sessionKey,
  provider,
  argentSessionServiceBaseUrl,
  useCacheAuthorisation,
}: BuildSessionAccountParams): Promise<Account> => {
  const dappService = new SessionAccount(
    session,
    sessionKey,
    argentSessionServiceBaseUrl,
  )

  return dappService.getAccountWithSessionSigner({
    provider,
    session,
    cacheAuthorisation: useCacheAuthorisation,
  })
}

export interface CreateSessionRequestParams {
  chainId: constants.StarknetChainId
  sessionParams: CreateSessionParams
}

export interface SessionRequest {
  sessionTypedData: TypedData
  offchainSession: OffChainSession
  sessionKey: SessionKey
}
/**
 * Creates a new session request.
 *
 * @param {Object} params - The parameters for creating the session request.
 * @param {constants.StarknetChainId} params.chainId - The chain ID for the session.
 * @param {CreateSessionParams} params.sessionParams - The parameters for the session.
 * @returns {Object} The session typed data and the offchain session object.
 * @throws {Error} If the sessionPublicKey is not provided.
 */
const createSessionRequest = ({
  chainId,
  sessionParams,
}: CreateSessionRequestParams): SessionRequest => {
  const {
    allowedMethods,
    expiry = BigInt(Date.now()) + 10000n,
    sessionKey,
    metaData,
  } = sessionParams

  if (!sessionKey || !sessionKey.publicKey) {
    throw new Error("sessionPublicKey is required")
  }

  const offchainSession = createOffchainSession(
    allowedMethods,
    expiry,
    metaData,
    sessionKey.publicKey,
  )

  return {
    sessionTypedData: getSessionTypedData(offchainSession, chainId),
    offchainSession,
    sessionKey,
  }
}

interface SignSessionMessageParams {
  address: string
  authorisationSignature: Signature
  sessionRequest: SessionRequest
  chainId: constants.StarknetChainId
}

/**
 * Creates a new session.
 *
 * @param {Object} params - The parameters for creating the session.
 * @param {string} params.address - The address of the user.
 * @param {Signature} params.authorisationSignature - The session signature.
 * @param {SessionRequest} params.sessionRequest - The session request.
 * @param {constants.StarknetChainId} params.chainId - The chain ID for the session.
 * @returns {Promise<Session>} A promise that resolves to the created session.
 * @throws {Error} If the sessionPublicKey is not provided.
 */
const createSession = async ({
  address,
  authorisationSignature,
  sessionRequest,
  chainId,
}: SignSessionMessageParams): Promise<Session> => {
  const { sessionKey, sessionTypedData, offchainSession } = sessionRequest

  if (!sessionKey || !sessionKey.publicKey) {
    throw new Error("sessionPublicKey is required")
  }

  const session: Session = {
    authorisationSignature,
    address,
    chainId,
    hash: typedData.getMessageHash(sessionTypedData, address),
    version: shortString.encodeShortString("1"),
    expiresAt: offchainSession.expires_at,
    allowedMethods: offchainSession.allowed_methods,
    metadata: offchainSession.metadata,
    sessionKeyGuid: offchainSession.session_key_guid,
    sessionKey,
  }

  return session
}

/**
 * Verifies the integrity and authenticity of a session using the provided session key.
 *
 * @param {Object} params - The parameters for verifying the session.
 * @param {Session} params.session - The session to be verified.
 * @param {SessionKey} params.sessionKey - The session key used for verification.
 * @returns {boolean} Returns true if the session is valid and the signature matches, otherwise false.
 */
const verifySession = ({
  session,
  sessionKey,
}: VerifySessionParams): boolean => {
  // TODO: placeholder fn
  const offchainSession: OffChainSession = {
    allowed_methods: session.allowedMethods,
    expires_at: session.expiresAt,
    metadata: session.metadata,
    session_key_guid: session.sessionKeyGuid,
  }
  const sessionTypedData = getSessionTypedData(offchainSession, session.chainId)
  const hash = typedData.getMessageHash(sessionTypedData, session.address)

  return (
    ec.starkCurve.sign(session.hash as string, sessionKey.privateKey) &&
    session.hash === hash
  )
}

/**
 * Converts a byte array to a hex string.
 * @param bytes The byte array to convert.
 * @returns The hex string.
 */
const bytesToHexString = (bytes: Uint8Array): string => {
  return encode.addHexPrefix(encode.buf2hex(bytes))
}

/**
 * Converts a hex string to a byte array.
 * @param hexString The hex string to convert.
 * @returns The byte array.
 */
const hexStringToBytes = (hexString: string): Uint8Array => {
  const hex = encode.removeHexPrefix(hexString)
  const hexArray = hex.match(/.{1,2}/g)
  if (!hexArray) {
    throw new Error("Invalid hex string")
  }
  return Uint8Array.from(hexArray.map((byte) => parseInt(byte, 16)))
}

export {
  buildSessionAccount,
  createOffchainSession,
  createSession,
  createSessionRequest,
  getSessionDomain,
  getSessionTypedData,
  sessionTypes,
  verifySession,
  bytesToHexString,
  hexStringToBytes,
}
