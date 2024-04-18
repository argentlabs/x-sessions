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
  ec,
  hash,
  merkle,
  selector,
  shortString,
  stark,
  transaction,
  typedData,
} from "starknet"

import { ArgentBackendService } from "./hybridSessionBackendService"
import { ALLOWED_METHOD_HASH } from "./utils"
import { signerTypeToCustomEnum } from "./signerTypeToCustomEnum"
import {
  OffChainSession,
  OnChainSession,
  SignerType,
} from "./hybridSessionTypes"

const SESSION_MAGIC = shortString.encodeShortString("session-token")

export class DappService {
  constructor(
    private argentBackend: ArgentBackendService,
    public sessionPk: Uint8Array,
    public sessionTypedData: TypedData,
  ) {}

  public getAccountWithSessionSigner(
    provider: ProviderInterface,
    account: Account,
    completedSession: OffChainSession,
    sessionAuthorizationSignature: ArraySignatureType,
  ) {
    const sessionSigner = new (class extends Signer {
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
    })((calls: Call[], invocationSignerDetails: InvocationsSignerDetails) => {
      return this.signRegularTransaction(
        sessionAuthorizationSignature,
        completedSession,
        calls,
        invocationSignerDetails,
      )
    })

    return new Account(provider, account.address, sessionSigner)
  }

  private async signRegularTransaction(
    sessionAuthorizationSignature: ArraySignatureType,
    completedSession: OffChainSession,
    calls: Call[],
    invocationSignerDetails: InvocationsSignerDetails,
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
      const det = invocationSignerDetails as V2InvocationsSignerDetails
      txHash = hash.calculateInvokeTransactionHash({
        ...det,
        senderAddress: det.walletAddress,
        compiledCalldata,
        version: det.version,
      })
    } else if (
      Object.values(RPC.ETransactionVersion3).includes(
        invocationSignerDetails.version as any,
      )
    ) {
      const det = invocationSignerDetails as V3InvocationsSignerDetails
      txHash = hash.calculateInvokeTransactionHash({
        ...det,
        senderAddress: det.walletAddress,
        compiledCalldata,
        version: det.version,
        nonceDataAvailabilityMode: stark.intDAM(det.nonceDataAvailabilityMode),
        feeDataAvailabilityMode: stark.intDAM(det.feeDataAvailabilityMode),
      })
    } else {
      throw Error("unsupported signTransaction version")
    }
    return this.compileSessionSignature(
      sessionAuthorizationSignature,
      completedSession,
      txHash,
      calls,
      invocationSignerDetails.walletAddress,
      invocationSignerDetails,
    )
  }

  private async compileSessionSignature(
    sessionAuthorizationSignature: ArraySignatureType,
    completedSession: OffChainSession,
    transactionHash: string,
    calls: Call[],
    accountAddress: string,
    invocationSignerDetails: InvocationsSignerDetails,
  ): Promise<ArraySignatureType> {
    const session = this.compileSessionHelper(completedSession)

    const guardianSignature = await this.argentBackend.signTxAndSession(
      calls,
      invocationSignerDetails,
      completedSession,
    )
    const sessionSignature = await this.signTxAndSession(
      transactionHash,
      accountAddress,
    )
    const sessionToken = await this.compileSessionTokenHelper(
      session,
      completedSession,
      calls,
      sessionSignature,
      sessionAuthorizationSignature,
      guardianSignature,
    )

    return [SESSION_MAGIC, ...CallData.compile(sessionToken)]
  }

  private async signTxAndSession(
    transactionHash: string,
    accountAddress: string,
  ): Promise<bigint[]> {
    const sessionMessageHash = typedData.getMessageHash(
      this.sessionTypedData,
      accountAddress,
    )
    const sessionWithTxHash = hash.computePoseidonHash(
      transactionHash,
      sessionMessageHash,
    )

    const signature = ec.starkCurve.sign(sessionWithTxHash, this.sessionPk)
    return [signature.r, signature.s]
  }

  private buildMerkleTree(
    completedSession: OffChainSession,
  ): merkle.MerkleTree {
    const leaves = completedSession.allowed_methods.map((method) =>
      hash.computePoseidonHashOnElements([
        ALLOWED_METHOD_HASH,
        method["Contract Address"],
        selector.getSelectorFromName(method.selector),
      ]),
    )
    return new merkle.MerkleTree(leaves, hash.computePoseidonHash)
  }

  private getSessionProofs(
    completedSession: OffChainSession,
    calls: Call[],
  ): string[][] {
    const tree = this.buildMerkleTree(completedSession)

    return calls.map((call) => {
      const allowedIndex = completedSession.allowed_methods.findIndex(
        (allowedMethod) => {
          return (
            allowedMethod["Contract Address"] == call.contractAddress &&
            allowedMethod.selector == call.entrypoint
          )
        },
      )
      return tree.getProof(tree.leaves[allowedIndex], tree.leaves)
    })
  }

  private compileSessionHelper(
    completedSession: OffChainSession,
  ): OnChainSession {
    const bArray = byteArray.byteArrayFromString(
      completedSession.metadata as string,
    )
    const elements = [
      bArray.data.length,
      ...bArray.data,
      bArray.pending_word,
      bArray.pending_word_len,
    ]
    const metadataHash = hash.computePoseidonHashOnElements(elements)

    const session = {
      expires_at: completedSession.expires_at,
      allowed_methods_root:
        this.buildMerkleTree(completedSession).root.toString(),
      metadata_hash: metadataHash,
      session_key_guid: completedSession.session_key_guid,
    }
    return session
  }

  private async compileSessionTokenHelper(
    session: OnChainSession,
    completedSession: OffChainSession,
    calls: Call[],
    sessionSignature: bigint[],
    session_authorization: string[],
    guardianSignature: bigint[],
  ) {
    return {
      session,
      session_authorization,
      sessionSignature: this.getStarknetSignatureType(
        ec.starkCurve.getStarkKey(this.sessionPk),
        sessionSignature,
      ),
      guardianSignature: this.getStarknetSignatureType(
        this.argentBackend.backendKey, // TODO: update with backend endpoint
        guardianSignature,
      ),
      proofs: this.getSessionProofs(completedSession, calls),
    }
  }

  // function needed as starknetSignatureType in signer.ts is already compiled
  private getStarknetSignatureType(pubkey: BigNumberish, signature: bigint[]) {
    return signerTypeToCustomEnum(SignerType.Starknet, {
      pubkey,
      r: signature[0],
      s: signature[1],
    })
  }

  // TODO: keep for future developments

  /* public async getOutsideExecutionCall(
    completedSession: OffChainSession,
    sessionAuthorizationSignature: ArraySignatureType,
    calls: Call[],
    revision: TypedDataRevision,
    accountAddress: string,
    caller = "ANY_CALLER",
    execute_after = 1,
    execute_before = 999999999999999,
    nonce = randomStarknetKeyPair().publicKey,
  ): Promise<Call> {
    const outsideExecution = {
      caller,
      nonce,
      execute_after,
      execute_before,
      calls: calls.map((call) => getOutsideCall(call)),
    }

    const currentTypedData = getTypedData(
      outsideExecution,
      await provider.getChainId(),
      revision,
    )
    const messageHash = typedData.getMessageHash(
      currentTypedData,
      accountAddress,
    )
    const signature = await this.compileSessionSignatureFromOutside(
      sessionAuthorizationSignature,
      completedSession,
      messageHash,
      calls,
      accountAddress,
      revision,
      outsideExecution,
    )

    return {
      contractAddress: accountAddress,
      entrypoint:
        revision == typedData.TypedDataRevision.Active
          ? "execute_from_outside_v2"
          : "execute_from_outside",
      calldata: CallData.compile({ ...outsideExecution, signature }),
    }
  } 
  
  private async compileSessionSignatureFromOutside(
    sessionAuthorizationSignature: ArraySignatureType,
    completedSession: OffChainSession,
    transactionHash: string,
    calls: Call[],
    accountAddress: string,
    revision: TypedDataRevision,
    outsideExecution: OutsideExecution,
  ): Promise<ArraySignatureType> {
    const session = this.compileSessionHelper(completedSession)

    const guardianSignature = await this.argentBackend.signOutsideTxAndSession(
      calls,
      completedSession,
      accountAddress,
      outsideExecution as OutsideExecution,
      revision,
    )

    const sessionSignature = await this.signTxAndSession(
      completedSession,
      transactionHash,
      accountAddress,
    )
    const sessionToken = await this.compileSessionTokenHelper(
      session,
      completedSession,
      calls,
      sessionSignature,
      sessionAuthorizationSignature,
      guardianSignature,
      accountAddress,
    )

    return [SESSION_MAGIC, ...CallData.compile(sessionToken)]
  } */
}
