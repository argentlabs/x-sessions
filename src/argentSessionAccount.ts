import {
  Abi,
  Account,
  AllowArray,
  Call,
  InvocationsSignerDetails,
  InvokeFunctionResponse,
  RPC,
  TransactionType,
  UniversalDetails,
  stark,
  transaction,
} from "starknet"

import { ensureArray } from "./ensureArray"

export class ArgentSessionAccount extends Account {
  override async execute(
    calls: AllowArray<Call>,
    abiOrDetails?: Abi[] | UniversalDetails,
    transactionsDetails: UniversalDetails = {},
  ): Promise<InvokeFunctionResponse> {
    const details =
      abiOrDetails === undefined || Array.isArray(abiOrDetails)
        ? transactionsDetails
        : abiOrDetails

    const transactions = ensureArray(calls)

    const version = stark.toTransactionVersion(
      this.getPreferredVersion(
        RPC.ETransactionVersion.V1,
        RPC.ETransactionVersion.V3,
      ), // TODO: does this depend on cairo version ?
      details.version,
    )
    const nonce = details.nonce ?? (await this.getNonce())
    const chainId = await this.getChainId()

    const estimate = await this.getUniversalSuggestedFee(
      version,
      { type: TransactionType.INVOKE, payload: transactions },
      {
        ...details,
        version,
      },
    )

    const signerDetails: InvocationsSignerDetails = {
      ...stark.v3Details(details),
      resourceBounds: estimate.resourceBounds,
      walletAddress: this.address,
      nonce,
      maxFee: estimate.maxFee,
      version,
      chainId,
      cairoVersion: await this.getCairoVersion(),
    }

    const signature = await this.signer.signTransaction(
      transactions,
      signerDetails,
    )

    const calldata = transaction.getExecuteCalldata(
      transactions,
      await this.getCairoVersion(),
    )

    return this.invokeFunction(
      { contractAddress: this.address, calldata, signature },
      {
        ...stark.v3Details(details),
        resourceBounds: estimate.resourceBounds,
        nonce,
        maxFee: estimate.maxFee,
        version,
      },
    )

    /* const calldata = transaction.fromCallsToExecuteCalldata_cairo1(transactions) */

    /* if (
      version !== "0x3" &&
      version !== "0x100000000000000000000000000000003"
    ) {
      const maxFee =
        details.maxFee ??
        (
          await this.getSuggestedFee(
            {
              type: TransactionType.INVOKE,
              // use_offchain_session needs to be not considered (entrypoint just for backend purposes)
              // if kept, the transaction max fee call will fail (and the cosign too)
              payload: transactions,
            },
            {
              skipValidate: true,
              nonce,
            },
          )
        ).suggestedMaxFee

      const signerDetails: InvocationsSignerDetails = {
        ...details,
        walletAddress: this.address,
        chainId,
        nonce,
        version,
        cairoVersion,
        maxFee,
      } satisfies V2InvocationsSignerDetails

      return await this.invokeFunction(
        {
          contractAddress: this.address,
          calldata,
          signature: await this.signer.signTransaction(
            transactions,
            signerDetails,
          ),
        },
        { ...details, nonce, version, maxFee: details.maxFee ?? maxFee },
      )
    } */

    /* debugger */
    /* const estimate = await this.estimateFee(calls, details) */
    /* const signerDetails: InvocationsSignerDetails = {
      // txv3
      ...details,
      walletAddress: this.address,
      chainId,
      nonce,
      version,
      cairoVersion,
      accountDeploymentData: details.accountDeploymentData
        ? details.accountDeploymentData
        : [],
      feeDataAvailabilityMode: details.feeDataAvailabilityMode
        ? details.feeDataAvailabilityMode
        : RPC.EDataAvailabilityMode.L1,
      nonceDataAvailabilityMode: details.nonceDataAvailabilityMode
        ? details.nonceDataAvailabilityMode
        : RPC.EDataAvailabilityMode.L1,
      paymasterData: details.paymasterData ? details.paymasterData : [],
      resourceBounds: details.resourceBounds
        ? details.resourceBounds
        : {
            ...estimate.resourceBounds,
            l1_gas: {
              ...estimate.resourceBounds.l1_gas,
              max_amount: num.toHexString(
                num.addPercent(estimate.resourceBounds.l1_gas.max_amount, 30),
              ),
            },
            l2_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
          },
      tip: details.tip ? details.tip : 0,
    } */

    /* return await this.invokeFunction(
      {
        contractAddress: this.address,
        calldata,
        signature: await this.signer.signTransaction(
          transactions,
          signerDetails,
        ),
      },
      { ...details, nonce },
    ) */
    /*  } catch (error) {
      throw error
    } */
  }
}
