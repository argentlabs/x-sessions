//import { getStarkKey, utils } from "@scure/starknet"
import {
  Account,
  ProviderInterface,
  ec,
  hash,
  shortString,
  stark,
  typedData,
} from "starknet"
import { StarknetChainId, StarknetDomain, TypedData } from "starknet-types"
import { ArgentBackendService } from "./argentBackendService"
import { DappService } from "./dappService"
import { AllowedMethod, OffChainSession } from "./types"

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
  signerPublicKey: string,
): OffChainSession => {
  const metadata = JSON.stringify({ metadata: "metadata", max_fee: 0 }) // need to be an input, update when blockchain/backend/whoever is ready to share

  return {
    expires_at: Number(expires_at),
    allowed_methods,
    metadata,
    session_key_guid: hash.computePoseidonHash(
      shortString.encodeShortString("Starknet Signer"),
      signerPublicKey,
    ),
  }
}

type CreateSessionParams = {
  provider: ProviderInterface
  account: Account
  allowedMethods: AllowedMethod[]
  expiry: bigint
  dappKey?: Uint8Array
}

const createSessionAccount = async ({
  provider,
  account,
  allowedMethods,
  expiry = BigInt(Date.now()) + 10000n,
  dappKey = ec.starkCurve.utils.randomPrivateKey(),
}: CreateSessionParams): Promise<Account> => {
  const sessionRequest = createSessionRequest(
    allowedMethods,
    expiry,
    ec.starkCurve.getStarkKey(dappKey),
  )

  const sessionTypedData = await getSessionTypedData(
    sessionRequest,
    await account.getChainId(),
  )

  const accountSessionSignature = await account.signMessage(sessionTypedData) // called by wallet

  //TODO: remove
  const backendKey = ec.starkCurve.utils.randomPrivateKey()
  const argentBackendService = new ArgentBackendService(
    sessionTypedData,
    backendKey,
  )

  const dappService = new DappService(
    argentBackendService,
    dappKey,
    sessionTypedData,
  )

  return dappService.getAccountWithSessionSigner(
    provider,
    account,
    sessionRequest,
    stark.formatSignature(accountSessionSignature),
  )
}

export {
  createSessionAccount,
  getSessionDomain,
  getSessionTypedData,
  sessionTypes,
}
