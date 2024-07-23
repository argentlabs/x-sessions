import * as u from "@noble/curves/abstract/utils"
import {
  Account,
  ArraySignatureType,
  BigNumberish,
  Call,
  CallData,
  InvocationsSignerDetails,
  ProviderInterface,
  RPC,
  Signer,
  TypedData,
  V2InvocationsSignerDetails,
  V3InvocationsSignerDetails,
  byteArray,
  constants,
  ec,
  encode,
  hash,
  merkle,
  num,
  selector,
  shortString,
  stark,
  transaction,
  typedData,
} from "starknet"
import {
  OutsideExecution,
  OutsideExecutionTypedData,
  OutsideExecutionTypedDataResponse,
  getOutsideCall,
  getOutsideExecutionTypedData,
} from "./outsideExecution"
import { ArgentSessionService } from "./argentSessionService"
import {
  ArgentServiceSignatureResponse,
  DappKey,
  OffChainSession,
  OnChainSession,
  SignerType,
} from "./sessionTypes"
import { signerTypeToCustomEnum } from "./signerTypeToCustomEnum"
import { ALLOWED_METHOD_HASH, getSessionTypedData } from "./utils"

const SESSION_MAGIC = shortString.encodeShortString("session-token")

class SessionSigner extends Signer {
  constructor(
    private signTransactionCallback: (
      calls: Call[],
      invocationSignerDetails: InvocationsSignerDetails,
    ) => Promise<ArraySignatureType>,
  ) {
    super()
  }

  public async signRaw(_: string): Promise<string[]> {
    throw new Error("Method not implemented.")
  }

  public async signTransaction(
    calls: Call[],
    invocationSignerDetails: InvocationsSignerDetails,
  ): Promise<ArraySignatureType> {
    return this.signTransactionCallback(calls, invocationSignerDetails)
  }
}

export class SessionDappService {
  constructor(
    private argentSessionService: ArgentSessionService,
    public chainId: constants.StarknetChainId,
    private dappKey: DappKey,
  ) {}

  public getAccountWithSessionSigner(
    provider: ProviderInterface,
    address: string,
    sessionRequest: OffChainSession,
    sessionAuthorizationSignature: ArraySignatureType,
    cacheAuthorisation: boolean = false,
  ) {
    const sessionSigner = new SessionSigner(
      (calls: Call[], invocationSignerDetails: InvocationsSignerDetails) => {
        return this.signTransaction(
          sessionAuthorizationSignature,
          sessionRequest,
          calls,
          invocationSignerDetails,
          cacheAuthorisation,
        )
      },
    )

    return new Account(provider, address, sessionSigner)
  }

  private async signTransaction(
    sessionAuthorizationSignature: ArraySignatureType,
    sessionRequest: OffChainSession,
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
    return this.getSessionSignatureForTransaction(
      sessionAuthorizationSignature,
      sessionRequest,
      txHash,
      calls,
      invocationSignerDetails.walletAddress,
      invocationSignerDetails,
      cacheAuthorisation,
    )
  }

  public async getSessionSignatureForTransaction(
    sessionAuthorizationSignature: ArraySignatureType,
    sessionRequest: OffChainSession,
    transactionHash: string,
    calls: Call[],
    accountAddress: string,
    invocationSignerDetails: InvocationsSignerDetails,
    cacheAuthorisation: boolean,
  ): Promise<ArraySignatureType> {
    const session = this.compileSessionHelper(sessionRequest)
    const sessionTypedData = getSessionTypedData(sessionRequest, this.chainId)

    const sessionSignature = await this.signTxAndSession(
      transactionHash,
      accountAddress,
      sessionTypedData,
      cacheAuthorisation,
    )

    const guardianSignature = await this.argentSessionService.signTxAndSession(
      calls,
      invocationSignerDetails,
      sessionTypedData,
      sessionSignature,
      cacheAuthorisation,
    )

    const sessionToken = await this.compileSessionTokenHelper(
      session,
      sessionRequest,
      calls,
      sessionSignature,
      sessionAuthorizationSignature,
      guardianSignature,
      cacheAuthorisation,
    )

    return [SESSION_MAGIC, ...CallData.compile(sessionToken)]
  }

  private async signTxAndSession(
    transactionHash: string,
    accountAddress: string,
    sessionTypedData: TypedData,
    cacheAuthorisation: boolean,
  ): Promise<bigint[]> {
    const sessionMessageHash = typedData.getMessageHash(
      sessionTypedData,
      accountAddress,
    )

    const sessionWithTxHash = hash.computePoseidonHashOnElements([
      transactionHash,
      sessionMessageHash,
      +cacheAuthorisation,
    ])

    const signature = ec.starkCurve.sign(
      sessionWithTxHash,
      this.dappKey.privateKey,
    )
    return [signature.r, signature.s]
  }

  private buildMerkleTree(sessionRequest: OffChainSession): merkle.MerkleTree {
    const leaves = sessionRequest.allowed_methods.map((method) =>
      hash.computePoseidonHashOnElements([
        ALLOWED_METHOD_HASH,
        method["Contract Address"],
        selector.getSelectorFromName(method.selector),
      ]),
    )
    return new merkle.MerkleTree(leaves, hash.computePoseidonHash)
  }

  private getSessionProofs(
    sessionRequest: OffChainSession,
    calls: Call[],
  ): string[][] {
    const tree = this.buildMerkleTree(sessionRequest)

    return calls.map((call) => {
      const allowedIndex = sessionRequest.allowed_methods.findIndex(
        (allowedMethod) => {
          return (
            num.hexToDecimalString(allowedMethod["Contract Address"]) ===
              num.hexToDecimalString(call.contractAddress) &&
            allowedMethod.selector == call.entrypoint
          )
        },
      )

      return tree.getProof(tree.leaves[allowedIndex], tree.leaves)
    })
  }

  private compileSessionHelper(
    sessionRequest: OffChainSession,
  ): OnChainSession {
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
      allowed_methods_root:
        this.buildMerkleTree(sessionRequest).root.toString(),
      metadata_hash: metadataHash,
      session_key_guid: sessionRequest.session_key_guid,
    }
    return session
  }

  private async compileSessionTokenHelper(
    session: OnChainSession,
    sessionRequest: OffChainSession,
    calls: Call[],
    sessionSignature: bigint[],
    session_authorization: string[],
    guardianSignature: ArgentServiceSignatureResponse,
    cache_authorization: boolean,
  ) {
    return {
      session,
      cache_authorization,
      session_authorization,
      sessionSignature: this.getStarknetSignatureType(
        this.dappKey.publicKey,
        sessionSignature,
      ),
      guardianSignature: this.getStarknetSignatureType(
        guardianSignature.publicKey,
        [guardianSignature.r, guardianSignature.s],
      ),
      proofs: this.getSessionProofs(sessionRequest, calls),
    }
  }

  // function needed as starknetSignatureType is already compiled
  private getStarknetSignatureType(pubkey: BigNumberish, signature: bigint[]) {
    return signerTypeToCustomEnum(SignerType.Starknet, {
      pubkey,
      r: signature[0],
      s: signature[1],
    })
  }

  public buildOutsideExecution(
    calls: Call[],
    caller?: string,
    execute_after?: BigNumberish,
    execute_before?: BigNumberish,
    nonce?: BigNumberish,
  ): OutsideExecution {
    const defaultCaller = shortString.encodeShortString("ANY_CALLER")

    const randomNonce = encode.addHexPrefix(
      u.bytesToHex(ec.starkCurve.utils.randomPrivateKey()),
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

  public buildOutsideExecutionTypedData(
    chainId: constants.StarknetChainId,
    calls: Call[],
    caller?: string,
    execute_after?: BigNumberish,
    execute_before?: BigNumberish,
    nonce?: BigNumberish,
  ): OutsideExecutionTypedData {
    const outsideExecution = this.buildOutsideExecution(
      calls,
      caller,
      execute_after,
      execute_before,
      nonce,
    )

    return getOutsideExecutionTypedData(outsideExecution, chainId)
  }

  public async getOutsideExecutionCall(
    sessionRequest: OffChainSession,
    sessionAuthorizationSignature: ArraySignatureType,
    cacheAuthorisation: boolean,
    calls: Call[],
    accountAddress: string,
    caller?: string,
    execute_after?: BigNumberish,
    execute_before?: BigNumberish,
    nonce?: BigNumberish,
  ): Promise<Call> {
    const outsideExecution = this.buildOutsideExecution(
      calls,
      caller,
      execute_after,
      execute_before,
      nonce,
    )

    const outsideExecutionTypedData = getOutsideExecutionTypedData(
      outsideExecution,
      this.chainId,
    )

    const signature =
      await this.getSessionSignatureForOutsideExecutionTypedData(
        sessionAuthorizationSignature,
        sessionRequest,
        calls,
        accountAddress,
        outsideExecutionTypedData,
        cacheAuthorisation,
      )

    return {
      contractAddress: accountAddress,
      entrypoint: "execute_from_outside_v2",
      calldata: CallData.compile({ ...outsideExecution, signature }),
    }
  }

  public async getSessionSignatureForOutsideExecutionTypedData(
    sessionAuthorizationSignature: ArraySignatureType,
    sessionRequest: OffChainSession,
    calls: Call[],
    accountAddress: string,
    outsideExecutionTypedData: TypedData,
    cacheAuthorisation: boolean,
  ): Promise<ArraySignatureType> {
    const session = this.compileSessionHelper(sessionRequest)
    const sessionTypedData = getSessionTypedData(sessionRequest, this.chainId)

    const messageHash = typedData.getMessageHash(
      outsideExecutionTypedData,
      accountAddress,
    )

    const sessionSignature = await this.signTxAndSession(
      messageHash,
      accountAddress,
      sessionTypedData,
      cacheAuthorisation,
    )

    const guardianSignature = await this.argentSessionService.signSessionEFO(
      sessionRequest,
      accountAddress,
      outsideExecutionTypedData,
      sessionSignature,
      cacheAuthorisation,
      this.chainId,
    )

    const sessionToken = await this.compileSessionTokenHelper(
      session,
      sessionRequest,
      calls,
      sessionSignature,
      sessionAuthorizationSignature,
      guardianSignature,
      cacheAuthorisation,
    )

    return [SESSION_MAGIC, ...CallData.compile(sessionToken)]
  }

  public async getOutsideExecutionTypedData(
    sessionRequest: OffChainSession,
    sessionAuthorizationSignature: ArraySignatureType,
    cacheAuthorisation: boolean,
    calls: Call[],
    accountAddress: string,
    caller?: string,
    execute_after?: BigNumberish,
    execute_before?: BigNumberish,
    nonce?: BigNumberish,
  ): Promise<OutsideExecutionTypedDataResponse> {
    const currentTypedData = this.buildOutsideExecutionTypedData(
      this.chainId,
      calls,
      caller,
      execute_after,
      execute_before,
      nonce,
    )

    const signature =
      await this.getSessionSignatureForOutsideExecutionTypedData(
        sessionAuthorizationSignature,
        sessionRequest,
        calls,
        accountAddress,
        currentTypedData,
        cacheAuthorisation,
      )

    return {
      outsideExecutionTypedData: currentTypedData,
      signature,
    }
  }
}
