import {
  Account,
  ArraySignatureType,
  Call,
  CallData,
  InvocationsSignerDetails,
  RPC,
  V2InvocationsSignerDetails,
  V3InvocationsSignerDetails,
  hash,
  shortString,
  stark,
  transaction,
} from "starknet"
import { argentSignTxAndSession } from "./argentBackendUtils"
import { ARGENT_SESSION_SERVICE_BASE_URL } from "./constants"
import { OffChainSession, Session, SessionKey } from "./session.types"
import {
  GetAccountWithSessionSignerParams,
  GetSessionSignatureForTransactionParams,
} from "./SessionAccount.types"
import { SessionSigner } from "./SessionSigner"
import {
  compileSessionHelper,
  compileSessionTokenHelper,
  signTxAndSession,
} from "./sessionUtils"
import { getSessionTypedData } from "./utils"

const SESSION_MAGIC = shortString.encodeShortString("session-token")

/**
 * Class representing a session account for managing transactions with session-based authorization.
 */
export class SessionAccount {
  public argentSessionServiceUrl: string

  /**
   * Creates an instance of SessionAccount.
   * @param session - The session object containing session details.
   * @param sessionKey - The session key used for signing transactions.
   * @param argentSessionServiceUrl - The base URL for the Argent session service.
   */
  constructor(
    public session: Session,
    public sessionKey: SessionKey,
    argentSessionServiceUrl: string = ARGENT_SESSION_SERVICE_BASE_URL,
  ) {
    this.argentSessionServiceUrl = argentSessionServiceUrl
  }

  /**
   * Retrieves an account with a session signer.
   *
   * @param {Object} params - The parameters for the function.
   * @param {Provider} params.provider - The provider to use for the account.
   * @param {Session} params.session - The session information.
   * @param {boolean} [params.cacheAuthorisation=false] - Whether to cache the authorisation signature.
   * @returns {Account} The account with the session signer.
   */
  public getAccountWithSessionSigner({
    provider,
    session,
    cacheAuthorisation = false,
  }: GetAccountWithSessionSignerParams) {
    const sessionSigner = new SessionSigner(
      (calls: Call[], invocationSignerDetails: InvocationsSignerDetails) => {
        return this.signTransaction(
          stark.formatSignature(session.authorisationSignature),
          session,
          calls,
          invocationSignerDetails,
          cacheAuthorisation,
        )
      },
    )

    return new Account(provider, session.address, sessionSigner)
  }

  private async signTransaction(
    sessionAuthorizationSignature: ArraySignatureType,
    session: Session,
    calls: Call[],
    invocationSignerDetails: InvocationsSignerDetails,
    cacheAuthorisation: boolean,
  ): Promise<ArraySignatureType> {
    const compiledCalldata = transaction.getExecuteCalldata(
      calls,
      invocationSignerDetails.cairoVersion,
    )

    let txHash
    if (
      Object.values(RPC.ETransactionVersion2).includes(
        invocationSignerDetails.version as any,
      )
    ) {
      const invocationsSignerDetailsV2 =
        invocationSignerDetails as V2InvocationsSignerDetails
      txHash = hash.calculateInvokeTransactionHash({
        ...invocationsSignerDetailsV2,
        senderAddress: invocationsSignerDetailsV2.walletAddress,
        compiledCalldata,
        version: invocationsSignerDetailsV2.version,
      })
    } else if (
      Object.values(RPC.ETransactionVersion3).includes(
        invocationSignerDetails.version as any,
      )
    ) {
      const invocationsSignerDetailsV3 =
        invocationSignerDetails as V3InvocationsSignerDetails
      txHash = hash.calculateInvokeTransactionHash({
        ...invocationsSignerDetailsV3,
        senderAddress: invocationsSignerDetailsV3.walletAddress,
        compiledCalldata,
        version: invocationsSignerDetailsV3.version,
        nonceDataAvailabilityMode: stark.intDAM(
          invocationsSignerDetailsV3.nonceDataAvailabilityMode,
        ),
        feeDataAvailabilityMode: stark.intDAM(
          invocationsSignerDetailsV3.feeDataAvailabilityMode,
        ),
      })
    } else {
      throw Error("unsupported signTransaction version")
    }
    return this.getSessionSignatureForTransaction({
      sessionAuthorizationSignature,
      session,
      transactionHash: txHash,
      calls,
      accountAddress: invocationSignerDetails.walletAddress,
      invocationSignerDetails,
      cacheAuthorisation,
    })
  }

  /**
   * Generates a session signature for a transaction.
   *
   * @param sessionAuthorizationSignature - The authorization signature for the session.
   * @param session - The session object containing session details.
   * @param transactionHash - The hash of the transaction.
   * @param calls - An array of calls to be made.
   * @param accountAddress - The address of the account.
   * @param invocationSignerDetails - Details of the invocation signer.
   * @param cacheAuthorisation - A boolean indicating whether to cache the authorization.
   * @returns A promise that resolves to an array containing the session signature.
   */
  public async getSessionSignatureForTransaction({
    sessionAuthorizationSignature,
    session,
    transactionHash,
    calls,
    accountAddress,
    invocationSignerDetails,
    cacheAuthorisation,
  }: GetSessionSignatureForTransactionParams): Promise<ArraySignatureType> {
    const offchainSession: OffChainSession = {
      allowed_methods: session.allowedMethods,
      expires_at: session.expiresAt,
      metadata: session.metadata,
      session_key_guid: session.sessionKeyGuid,
    }

    const compiledSession = compileSessionHelper(offchainSession)

    const sessionTypedData = getSessionTypedData(
      offchainSession,
      this.session.chainId,
    )

    const sessionSignature = signTxAndSession(
      transactionHash,
      accountAddress,
      sessionTypedData,
      cacheAuthorisation,
      this.sessionKey,
    )

    const guardianSignature = await argentSignTxAndSession({
      sessionKey: this.sessionKey,
      authorisationSignature: this.session.authorisationSignature,
      argentSessionServiceBaseUrl: this.argentSessionServiceUrl,
      calls,
      transactionsDetail: invocationSignerDetails,
      sessionTypedData,
      sessionSignature,
      cacheAuthorisation,
    })

    const sessionToken = await compileSessionTokenHelper(
      compiledSession,
      offchainSession,
      this.sessionKey,
      calls,
      sessionSignature,
      sessionAuthorizationSignature,
      guardianSignature,
      cacheAuthorisation,
    )

    return [SESSION_MAGIC, ...CallData.compile(sessionToken)]
  }
}
