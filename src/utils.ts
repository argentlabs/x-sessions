import { Account, ec, hash, shortString, stark, typedData } from "starknet"
import { StarknetChainId, StarknetDomain, TypedData } from "starknet-types"
import { ArgentBackendService } from "./hybridSessionBackendService"
import { DappService } from "./hybridSessionDappService"
import {
  AllowedMethod,
  CreateSessionParams,
  OffChainSession,
  SessionMetadata,
} from "./hybridSessionTypes"

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
  typedData.TypedDataRevision.Active,
)

// WARNING! Revision is encoded as a number in the StarkNetDomain type and not as shortstring
// This is due to a bug in the Braavos implementation, and has been kept for compatibility
const getSessionDomain = async (
  chainId: StarknetChainId,
): Promise<StarknetDomain> => ({
  name: "SessionAccount.session",
  version: shortString.encodeShortString("1"),
  chainId,
  revision: "1",
})

const getSessionTypedData = async (
  sessionRequest: OffChainSession,
  chainId: StarknetChainId,
): Promise<TypedData> => {
  return {
    types: sessionTypes,
    primaryType: "Session",
    domain: await getSessionDomain(chainId),
    message: {
      "Expires At": sessionRequest.expires_at,
      "Allowed Methods": sessionRequest.allowed_methods,
      Metadata: sessionRequest.metadata,
      "Session Key": sessionRequest.session_key_guid,
    },
  }
}

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

const createSessionAccount = async ({
  provider,
  account,
  sessionParams,
  options = {},
  wallet,
}: CreateSessionParams): Promise<Account> => {
  const {
    allowedMethods,
    expiry = BigInt(Date.now()) + 10000n,
    dappKey = ec.starkCurve.utils.randomPrivateKey(),
    metaData,
    cacheAuthorization = false,
  } = sessionParams

  const sessionRequest = createSessionRequest(
    allowedMethods,
    expiry,
    metaData,
    ec.starkCurve.getStarkKey(dappKey),
  )

  const sessionTypedData = await getSessionTypedData(
    sessionRequest,
    await account.getChainId(),
  )

  const { useWalletRequestMethods } = options

  // When jsonRPC spec will become the standard, this can be removed
  // and use wallet.request only
  const accountSessionSignature =
    useWalletRequestMethods && wallet
      ? await wallet.request({
          type: "starknet_signTypedData",
          params: sessionTypedData,
        })
      : await account.signMessage(sessionTypedData)

  const argentBackendService = new ArgentBackendService(
    ec.starkCurve.getStarkKey(dappKey),
    accountSessionSignature,
  )

  const dappService = new DappService(argentBackendService, dappKey)

  return dappService.getAccountWithSessionSigner(
    provider,
    account,
    sessionRequest,
    stark.formatSignature(accountSessionSignature),
    sessionTypedData,
    cacheAuthorization,
  )
}

export {
  createSessionAccount,
  getSessionDomain,
  getSessionTypedData,
  sessionTypes,
}
