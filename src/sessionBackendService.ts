import {
  Call,
  InvocationsSignerDetails,
  RPC,
  Signature,
  V2InvocationsSignerDetails,
  V3InvocationsSignerDetails,
  constants,
  num,
  stark,
  transaction,
  typedData,
} from "starknet"

import { TypedData } from "starknet-types"
import {
  BackendSessionBody,
  BackendSignSessionBody,
  BackendSignatureResponse,
} from "./sessionTypes"
import { SignSessionError } from "./errors"

export class ArgentBackendService {
  constructor(
    public pubkey: string,
    private accountSessionSignature: Signature,
  ) {}

  private getApiBaseUrl(chainId: constants.StarknetChainId): string {
    return chainId === constants.StarknetChainId.SN_MAIN
      ? "https://cloud.argent-api.com/v1"
      : "https://cloud-dev.argent-api.com/v1"
  }

  public async signTxAndSession(
    calls: Call[],
    transactionsDetail: InvocationsSignerDetails,
    sessionTypedData: TypedData,
    sessionSignature: bigint[],
    cacheAuthorisation: boolean,
  ): Promise<BackendSignatureResponse> {
    const compiledCalldata = transaction.getExecuteCalldata(
      calls,
      transactionsDetail.cairoVersion,
    )

    const sessionHash = typedData.getMessageHash(
      sessionTypedData,
      transactionsDetail.walletAddress,
    )

    const sessionAuthorisation = stark.formatSignature(
      this.accountSessionSignature,
    )

    let apiBaseUrl: string | null = null

    const session: BackendSessionBody = {
      sessionHash,
      sessionAuthorisation,
      cacheAuthorisation,
      sessionSignature: {
        type: "StarknetKey",
        signer: {
          publicKey: this.pubkey,
          r: sessionSignature[0].toString(),
          s: sessionSignature[1].toString(),
        },
      },
    }

    const body: BackendSignSessionBody = {
      session,
    }

    if (
      Object.values(RPC.ETransactionVersion2).includes(
        transactionsDetail.version as any,
      )
    ) {
      const txDetailsV2 = transactionsDetail as V2InvocationsSignerDetails
      apiBaseUrl = this.getApiBaseUrl(txDetailsV2.chainId)

      body.transaction = {
        contractAddress: txDetailsV2.walletAddress,
        calldata: compiledCalldata,
        maxFee: txDetailsV2.maxFee.toString(),
        nonce: txDetailsV2.nonce.toString(),
        version: num.toBigInt(txDetailsV2.version).toString(10),
        chainId: num.toBigInt(txDetailsV2.chainId).toString(10),
      }
    } else if (
      Object.values(RPC.ETransactionVersion3).includes(
        transactionsDetail.version as any,
      )
    ) {
      const txDetailsV3 = transactionsDetail as V3InvocationsSignerDetails
      apiBaseUrl = this.getApiBaseUrl(txDetailsV3.chainId)

      body.transaction = {
        sender_address: txDetailsV3.walletAddress,
        calldata: compiledCalldata,
        nonce: txDetailsV3.nonce.toString(),
        version: num.toBigInt(txDetailsV3.version).toString(10),
        chainId: num.toBigInt(txDetailsV3.chainId).toString(10),
        resource_bounds: {
          l1_gas: {
            max_amount: txDetailsV3.resourceBounds.l1_gas.max_amount.toString(),
            max_price_per_unit:
              txDetailsV3.resourceBounds.l1_gas.max_price_per_unit.toString(),
          },
          l2_gas: {
            max_amount: txDetailsV3.resourceBounds.l1_gas.max_amount.toString(),
            max_price_per_unit:
              txDetailsV3.resourceBounds.l1_gas.max_price_per_unit.toString(),
          },
        },
        tip: txDetailsV3.tip.toString(),
        paymaster_data: txDetailsV3.paymasterData.map((pm) => pm.toString()),
        account_deployment_data: txDetailsV3.accountDeploymentData,
        nonce_data_availability_mode: txDetailsV3.nonceDataAvailabilityMode,
        fee_data_availability_mode: txDetailsV3.feeDataAvailabilityMode,
      }
    } else {
      throw Error("unsupported signTransaction version")
    }

    const response = await fetch(`${apiBaseUrl}/cosigner/signSession`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error: { status: string } = await response.json()
      throw new SignSessionError("Sign session error", error.status)
    }

    const json = await response.json()
    return json.signature
  }

  /* public async signOutsideTxAndSession(
    calls: Call[],
    sessionTokenToSign: OffChainSession,
    accountAddress: string,
    outsideExecution: OutsideExecution,
    revision: TypedDataRevision,
  ): Promise<bigint[]> {
    // TODO backend must verify, timestamps fees, used tokens nfts...
    const currentTypedData = getTypedData(
      outsideExecution,
      await provider.getChainId(),
      revision,
    )
    const messageHash = typedData.getMessageHash(
      currentTypedData,
      accountAddress,
    )

    const sessionMessageHash = typedData.getMessageHash(
      await getSessionTypedData(sessionTokenToSign),
      accountAddress,
    )
    const sessionWithTxHash = hash.computePoseidonHash(
      messageHash,
      sessionMessageHash,
    )
    const signature = ec.starkCurve.sign(
      sessionWithTxHash,
      num.toHex(this.backendKey.privateKey),
    )
    return [signature.r, signature.s]
  } */
}
