import {
  Call,
  InvocationsSignerDetails,
  RPC,
  Signature,
  V2InvocationsSignerDetails,
  V3InvocationsSignerDetails,
  num,
  stark,
  transaction,
  typedData,
} from "starknet"

import { StarknetChainId, TypedData } from "starknet-types"
import { ARGENT_BACKEND_BASE_URL } from "./constants"
import { SignSessionError } from "./errors"
import { OutsideExecution, getTypedData } from "./outsideExecution"
import {
  BackendSessionBody,
  BackendSignSessionBody,
  BackendSignatureResponse,
  OffChainSession,
} from "./sessionTypes"
import { getSessionTypedData } from "./utils"

export class ArgentBackendSessionService {
  constructor(
    public pubkey: string,
    private accountSessionSignature: Signature,
    private argentBackendBaseUrl = ARGENT_BACKEND_BASE_URL,
  ) {}

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

    const response = await fetch(
      `${this.argentBackendBaseUrl}/cosigner/signSession`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    )

    if (!response.ok) {
      const error: { status: string } = await response.json()
      throw new SignSessionError("Sign session error", error.status)
    }

    const json = await response.json()
    return json.signature
  }

  public signTypedDataAndSession(
    sessionTokenToSign: OffChainSession,
    accountAddress: string,
    currentTypedData: TypedData,
    sessionSignature: bigint[],
    cacheAuthorisation: boolean,
    chainId: StarknetChainId,
  ): Promise<BackendSignatureResponse> {
    return this.callSignSessionEFO(
      sessionTokenToSign,
      accountAddress,
      currentTypedData,
      sessionSignature,
      cacheAuthorisation,
      chainId,
    )
  }

  public async signOutsideTxAndSession(
    sessionTokenToSign: OffChainSession,
    accountAddress: string,
    outsideExecution: OutsideExecution,
    sessionSignature: bigint[],
    cacheAuthorisation: boolean,
    chainId: StarknetChainId,
  ): Promise<BackendSignatureResponse> {
    const currentTypedData = getTypedData(outsideExecution, chainId)
    return this.callSignSessionEFO(
      sessionTokenToSign,
      accountAddress,
      currentTypedData,
      sessionSignature,
      cacheAuthorisation,
      chainId,
    )
  }

  private async callSignSessionEFO(
    sessionTokenToSign: OffChainSession,
    accountAddress: string,
    currentTypedData: TypedData,
    sessionSignature: bigint[],
    cacheAuthorisation: boolean,
    chainId: StarknetChainId,
  ): Promise<BackendSignatureResponse> {
    const sessionMessageHash = typedData.getMessageHash(
      getSessionTypedData(sessionTokenToSign, chainId),
      accountAddress,
    )

    const sessionAuthorisation = stark.formatSignature(
      this.accountSessionSignature,
    )

    const session: BackendSessionBody = {
      sessionHash: sessionMessageHash,
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

    const message = {
      type: "eip712",
      accountAddress,
      chain: "starknet",
      message: currentTypedData,
    }

    const body = {
      session,
      message,
    }

    // needed due to bigint serialization
    const stringifiedBody = JSON.stringify(body, (_, v) =>
      typeof v === "bigint" ? v.toString() : v,
    )

    const response = await fetch(
      `${this.argentBackendBaseUrl}/cosigner/signSessionEFO`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: stringifiedBody,
      },
    )

    if (!response.ok) {
      const error: { status: string } = await response.json()
      throw new SignSessionError("Sign session error", error.status)
    }

    const json = await response.json()
    return json.signature
  }
}
