import {
  Account,
  Signature,
  constants,
  hash,
  shortString,
  typedData,
} from "starknet"
import {
  StarknetDomain,
  StarknetWindowObject,
  TypedData,
} from "@starknet-io/types-js"
import { ArgentSessionService } from "./argentSessionService"
import { SessionDappService } from "./sessionDappService"
import {
  AllowedMethod,
  CreateSessionParams,
  OffChainSession,
  SessionMetadata,
  SessionParams,
} from "./sessionTypes"

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

const createSessionRequest = (
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

const buildSessionAccount = async ({
  useCacheAuthorisation,
  accountSessionSignature,
  sessionRequest,
  provider,
  chainId,
  address,
  dappKey,
  argentSessionServiceBaseUrl,
}: CreateSessionParams): Promise<Account> => {
  const argentSessionService = new ArgentSessionService(
    dappKey.publicKey,
    accountSessionSignature,
    argentSessionServiceBaseUrl,
  )

  const dappService = new SessionDappService(
    argentSessionService,
    chainId,
    dappKey,
  )

  return dappService.getAccountWithSessionSigner(
    provider,
    address,
    sessionRequest,
    accountSessionSignature,
    useCacheAuthorisation,
  )
}

interface SignSessionMessageParams {
  wallet: StarknetWindowObject
  sessionParams: SessionParams
  chainId: constants.StarknetChainId
}

const openSession = async ({
  wallet,
  sessionParams,
  chainId,
}: SignSessionMessageParams): Promise<string[] | Signature> => {
  const {
    allowedMethods,
    expiry = BigInt(Date.now()) + 10000n,
    publicDappKey,
    metaData,
  } = sessionParams

  if (!publicDappKey) {
    throw new Error("publicDappKey is required")
  }

  const sessionRequest = createSessionRequest(
    allowedMethods,
    expiry,
    metaData,
    publicDappKey,
  )

  const sessionTypedData = getSessionTypedData(sessionRequest, chainId)

  return await wallet.request({
    type: "wallet_signTypedData",
    params: sessionTypedData,
  })
}

export {
  buildSessionAccount,
  createSessionRequest,
  getSessionDomain,
  getSessionTypedData,
  openSession,
  sessionTypes,
}
