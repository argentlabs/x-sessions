import * as nobleUtils from "@noble/curves/abstract/utils"
import {
  ArraySignatureType,
  BigNumberish,
  Call,
  CallData,
  ec,
  encode,
  hash,
  num,
  shortString,
  stark,
  typedData,
} from "starknet"
import { signTxAndSession } from "./sessionUtils"
import { ARGENT_SESSION_SERVICE_BASE_URL } from "./constants"
import {
  BuildOutsideExecutionTypedDataParams,
  CreateOutsideExecutionCallParams,
  CreateOutsideExecutionTypedData,
  OutsideCall,
  OutsideExecution,
  SignOutsideExecutionParams,
} from "./outsideExecution.types"
import { OffChainSession } from "./session.types"
import { compileSessionHelper, compileSessionTokenHelper } from "./sessionUtils"
import { getSessionTypedData } from "./utils"
import { argentSignSessionEFO } from "./argentBackendUtils"

export const typesRev1 = {
  StarknetDomain: [
    { name: "name", type: "shortstring" },
    { name: "version", type: "shortstring" },
    { name: "chainId", type: "shortstring" },
    { name: "revision", type: "shortstring" },
  ],
  OutsideExecution: [
    { name: "Caller", type: "ContractAddress" },
    { name: "Nonce", type: "felt" },
    { name: "Execute After", type: "u128" },
    { name: "Execute Before", type: "u128" },
    { name: "Calls", type: "Call*" },
  ],
  Call: [
    { name: "To", type: "ContractAddress" },
    { name: "Selector", type: "selector" },
    { name: "Calldata", type: "felt*" },
  ],
}

function getDomain(chainId: string, version: string = "1") {
  // WARNING! Version and revision are encoded as numbers in the StarkNetDomain type and not as shortstring
  // This is due to a bug in the Braavos implementation, and has been kept for compatibility
  return {
    name: "Account.execute_from_outside",
    version,
    chainId,
    revision: "1",
  }
}

export function getOutsideCall(call: Call): OutsideCall {
  return {
    to: call.contractAddress,
    selector: hash.getSelectorFromName(call.entrypoint),
    calldata: call.calldata ?? [],
  }
}

export function getTypedDataHash(
  outsideExecution: OutsideExecution,
  accountAddress: num.BigNumberish,
  chainId: string,
  version: string = "1",
): string {
  return typedData.getMessageHash(
    buildOutsideExecutionTypedData({
      outsideExecution,
      chainId,
      version,
    }),
    accountAddress,
  )
}

export const buildOutsideExecution = (
  calls: Call[],
  caller?: string,
  execute_after?: BigNumberish,
  execute_before?: BigNumberish,
  nonce?: BigNumberish,
): OutsideExecution => {
  const defaultCaller = shortString.encodeShortString("ANY_CALLER")

  const randomNonce = encode.addHexPrefix(
    nobleUtils.bytesToHex(ec.starkCurve.utils.randomPrivateKey()),
  )

  const now = Date.now()
  const defaultExecuteBefore = Math.floor((now + 60_000 * 20) / 1000)
  const defaultExecuteAfter = Math.floor((now - 60_000 * 10) / 1000)

  return {
    caller: caller || defaultCaller,
    nonce: nonce || randomNonce,
    execute_after: execute_after || defaultExecuteAfter,
    execute_before: execute_before || defaultExecuteBefore,
    calls: calls.map((call) => getOutsideCall(call)),
  }
}

/**
 * Creates the outside call.
 *
 * @param {Object} params - The parameters for creating the outside execution typed data.
 * @param {Session} params.session - The session object containing session details.
 * @param {string} params.sessionKey - The session key used for authentication.
 * @param {boolean} params.cacheAuthorisation - Flag indicating whether to cache the authorisation.
 * @param {Array<Call>} params.calls - The array of calls to be executed.
 * @param {OutsideExecutionParams} params.outsideExecutionParams - The parameters for the outside execution.
 * @param {string} [params.argentSessionServiceUrl=ARGENT_SESSION_SERVICE_BASE_URL] - The URL of the Argent session service.
 *
 * @returns {Promise<{ outsideExecutionTypedData: OutsideExecutionTypedData, signature: string }>} The typed data for the outside execution and the signature.
 */
export const createOutsideExecutionCall = async ({
  session,
  sessionKey,
  cacheAuthorisation,
  calls,
  outsideExecutionParams,
  argentSessionServiceUrl = ARGENT_SESSION_SERVICE_BASE_URL,
}: CreateOutsideExecutionCallParams): Promise<Call> => {
  const { caller, execute_after, execute_before, nonce, version } =
    outsideExecutionParams || {}

  const outsideExecution = buildOutsideExecution(
    calls,
    caller,
    execute_after,
    execute_before,
    nonce,
  )

  const outsideExecutionTypedData = buildOutsideExecutionTypedData({
    outsideExecution,
    chainId: session.chainId,
    version: version || "1",
  })

  const signature = await signOutsideExecution({
    session,
    sessionKey,
    argentSessionServiceUrl,
    outsideExecutionTypedData,
    cacheAuthorisation,
    calls,
  })

  return {
    contractAddress: session.address,
    entrypoint: "execute_from_outside_v2",
    calldata: CallData.compile({ ...outsideExecution, signature }),
  }
}

/**
 * Creates the typed data for an outside execution and signs it.
 *
 * @param {Object} params - The parameters for creating the outside execution typed data.
 * @param {Session} params.session - The session object containing session details.
 * @param {string} params.sessionKey - The session key used for authentication.
 * @param {boolean} params.cacheAuthorisation - Flag indicating whether to cache the authorisation.
 * @param {Array<Call>} params.calls - The array of calls to be executed.
 * @param {OutsideExecutionParams} params.outsideExecutionParams - The parameters for the outside execution.
 * @param {string} [params.argentSessionServiceUrl=ARGENT_SESSION_SERVICE_BASE_URL] - The URL of the Argent session service.
 *
 * @returns {Promise<{ outsideExecutionTypedData: OutsideExecutionTypedData, signature: string }>} The typed data for the outside execution and the signature.
 */
export const createOutsideExecutionTypedData = async ({
  session,
  sessionKey,
  cacheAuthorisation,
  calls,
  outsideExecutionParams,
  argentSessionServiceUrl = ARGENT_SESSION_SERVICE_BASE_URL,
}: CreateOutsideExecutionTypedData) => {
  const { caller, execute_after, execute_before, nonce, version } =
    outsideExecutionParams || {}

  const outsideExecution = buildOutsideExecution(
    calls,
    caller,
    execute_after,
    execute_before,
    nonce,
  )

  const outsideExecutionTypedData = buildOutsideExecutionTypedData({
    outsideExecution,
    chainId: session.chainId,
    version: version || "1",
  })

  const signature = await signOutsideExecution({
    argentSessionServiceUrl,
    cacheAuthorisation,
    calls,
    outsideExecutionTypedData,
    session,
    sessionKey,
  })

  return {
    outsideExecutionTypedData,
    signature,
  }
}

export const buildOutsideExecutionTypedData = ({
  outsideExecution,
  chainId,
  version = "1",
}: BuildOutsideExecutionTypedDataParams) => ({
  types: typesRev1,
  primaryType: "OutsideExecution",
  domain: getDomain(chainId, version),
  message: {
    Caller: outsideExecution.caller,
    Nonce: outsideExecution.nonce,
    "Execute After": outsideExecution.execute_after,
    "Execute Before": outsideExecution.execute_before,
    Calls: outsideExecution.calls.map((call) => {
      return {
        To: call.to,
        Selector: call.selector,
        Calldata: call.calldata,
      }
    }),
  },
})

/**
 * Signs the outside execution.
 *
 * @param {Object} params - The parameters for signing the outside execution.
 * @param {Session} params.session - The session object containing session details.
 * @param {string} params.sessionKey - The session key used for authentication.
 * @param {TypedData} params.outsideExecutionTypedData - The typed data for the outside execution.
 * @param {string} [params.argentSessionServiceUrl=ARGENT_SESSION_SERVICE_BASE_URL] - The URL of the Argent session service.
 * @param {boolean} [params.cacheAuthorisation=false] - Flag indicating whether to cache the authorisation.
 * @param {Array<Call>} params.calls - The array of calls to be executed.
 *
 * @returns {Promise<ArraySignatureType>} The signature.
 */
export const signOutsideExecution = async ({
  session,
  sessionKey,
  outsideExecutionTypedData,
  argentSessionServiceUrl = ARGENT_SESSION_SERVICE_BASE_URL,
  cacheAuthorisation = false,
  calls,
}: SignOutsideExecutionParams): Promise<ArraySignatureType> => {
  const sessionRequest: OffChainSession = {
    expires_at: session.expiresAt,
    allowed_methods: session.allowedMethods,
    metadata: session.metadata,
    session_key_guid: session.sessionKeyGuid,
  }

  const SESSION_MAGIC = shortString.encodeShortString("session-token")

  const compiledSession = compileSessionHelper(sessionRequest)
  const sessionTypedData = getSessionTypedData(sessionRequest, session.chainId)

  const messageHash = typedData.getMessageHash(
    outsideExecutionTypedData,
    session.address,
  )

  const sessionSignature = signTxAndSession(
    messageHash,
    session.address,
    sessionTypedData,
    cacheAuthorisation,
    sessionKey,
  )

  const guardianSignature = await argentSignSessionEFO({
    sessionKey,
    authorisationSignature: session.authorisationSignature,
    argentSessionServiceBaseUrl: argentSessionServiceUrl,
    sessionTokenToSign: sessionRequest,
    accountAddress: session.address,
    currentTypedData: outsideExecutionTypedData,
    sessionSignature,
    cacheAuthorisation,
    chainId: session.chainId,
  })

  const sessionToken = await compileSessionTokenHelper(
    compiledSession,
    sessionRequest,
    sessionKey,
    calls,
    sessionSignature,
    stark.formatSignature(session.authorisationSignature),
    guardianSignature,
    cacheAuthorisation,
  )

  return [SESSION_MAGIC, ...CallData.compile(sessionToken)].map((item) =>
    num.toHex(item),
  )
}
