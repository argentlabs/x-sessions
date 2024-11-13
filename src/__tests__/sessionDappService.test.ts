import {
  Account,
  Call,
  RpcProvider,
  V2InvocationsSignerDetails,
  constants,
  ec,
  stark,
} from "starknet"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { ArgentSessionService } from "../argentSessionService"
import {
  outsideExecutionTypedDataFixture,
  outsideExecutionTypedDataFixture_v2,
} from "./fixture"

const allowedMethodContractAddress = stark.randomAddress()

const cacheAuthorisation = false
const sessionRequest = {
  expires_at: 1234567890,
  allowed_methods: [
    {
      "Contract Address": allowedMethodContractAddress,
      selector: "some_method",
    },
  ],
  metadata: JSON.stringify({
    projectID: "test",
    txFees: [
      { tokenAddress: stark.randomAddress(), maxAmount: "1000000000000" },
    ],
  }),
  session_key_guid:
    "0x116dcea0b31d06f721c156324cd8de3652bf8953cd5ba055f74db21b1134ec9",
}
const sessionAuthorizationSignature = ["signature1", "signature2"]

describe("SessionDappService", () => {
  let chainId: constants.StarknetChainId
  let privateSessionKey: Uint8Array
  let publicSessionKey: string
  let argentSessionService: ArgentSessionService

  beforeAll(async () => {
    chainId = constants.StarknetChainId.SN_SEPOLIA
    privateSessionKey = ec.starkCurve.utils.randomPrivateKey()
    publicSessionKey = ec.starkCurve.getStarkKey(privateSessionKey)

    argentSessionService = new ArgentSessionService(
      chainId,
      {
        privateKey: privateSessionKey,
        publicKey: publicSessionKey,
      },
      sessionAuthorizationSignature,
    )
    vi.spyOn(
      argentSessionService.argentService,
      "signTxAndSession",
    ).mockImplementation(async () => ({
      publicKey: "0x123",
      r: 10n,
      s: 10n,
    }))
  })

  it("should get an account with session signer", async () => {
    const provider = new RpcProvider()
    const address = stark.randomAddress()

    const account = argentSessionService.getAccountWithSessionSigner(
      provider,
      address,
      sessionRequest,
      sessionAuthorizationSignature,
      cacheAuthorisation,
    )

    expect(account).toBeInstanceOf(Account)
  })

  it("should signTransaction calling argent session service", async () => {
    const invokationDetails: V2InvocationsSignerDetails = {
      cairoVersion: "1",
      chainId,
      maxFee: 1000n,
      nonce: 1,
      version: "0x2",
      walletAddress: stark.randomAddress(),
    }

    const signatureResult: any = await (
      argentSessionService as any
    ).signTransaction(
      sessionAuthorizationSignature,
      sessionRequest,
      [],
      invokationDetails,
      cacheAuthorisation,
    )

    expect(signatureResult).toBeInstanceOf(Array)
    expect(
      argentSessionService.argentService.signTxAndSession,
    ).toHaveBeenCalled()
    expect(argentSessionService.argentService.signTxAndSession).toReturnWith({
      publicKey: "0x123",
      r: 10n,
      s: 10n,
    })
  })

  it("should get an outside execution call with getOutsideExecutionCall", async () => {
    const provider = new RpcProvider()
    vi.spyOn(provider, "getChainId").mockImplementation(
      async () => constants.StarknetChainId.SN_SEPOLIA,
    )
    const address = stark.randomAddress()
    const caller = "0x123"
    const execute_after = 1
    const execute_before = 999999999999999
    const calls: Call[] = [
      {
        contractAddress: allowedMethodContractAddress,
        entrypoint: "some_method",
        calldata: ["0x123"],
      },
    ]

    vi.spyOn(
      argentSessionService.argentService,
      "signSessionEFO",
    ).mockImplementation(async () => ({
      publicKey: "0x123",
      r: 10n,
      s: 10n,
    }))

    const outsideExecutionCall =
      await argentSessionService.getOutsideExecutionCall(
        sessionRequest,
        sessionAuthorizationSignature,
        cacheAuthorisation,
        calls,
        address,
        constants.StarknetChainId.SN_SEPOLIA,
        caller,
        execute_after,
        execute_before,
      )

    expect(outsideExecutionCall.entrypoint).toEqual("execute_from_outside_v2")
    expect(outsideExecutionCall.contractAddress).toEqual(address)
    expect(outsideExecutionCall.calldata).toBeInstanceOf(Array)
    expect(outsideExecutionCall.calldata).not.toBe([])
  })

  it("should get an outside execution call with getOutsideExecutionTypedData", async () => {
    const provider = new RpcProvider()
    vi.spyOn(provider, "getChainId").mockImplementation(
      async () => constants.StarknetChainId.SN_SEPOLIA,
    )
    const address = stark.randomAddress()
    const execute_after = 1
    const execute_before = 999999999999999
    const nonce = "0x1"
    const calls: Call[] = [
      {
        contractAddress: allowedMethodContractAddress,
        entrypoint: "some_method",
        calldata: ["0x123"],
      },
    ]

    vi.spyOn(
      argentSessionService.argentService,
      "signSessionEFO",
    ).mockImplementation(async () => ({
      publicKey: "0x123",
      r: 10n,
      s: 10n,
    }))

    const { signature, outsideExecutionTypedData } =
      await argentSessionService.getOutsideExecutionTypedData(
        sessionRequest,
        sessionAuthorizationSignature,
        false,
        calls,
        address,
        "",
        execute_after,
        execute_before,
        nonce,
      )

    expect(signature).toBeInstanceOf(Array)
    expect(outsideExecutionTypedData).toStrictEqual(
      outsideExecutionTypedDataFixture(allowedMethodContractAddress),
    )
  })

  it("should get an outside execution call with getOutsideExecutionTypedData", async () => {
    const provider = new RpcProvider()
    vi.spyOn(provider, "getChainId").mockImplementation(
      async () => constants.StarknetChainId.SN_SEPOLIA,
    )
    const address = stark.randomAddress()
    const execute_after = 1
    const execute_before = 999999999999999
    const nonce = "0x1"
    const calls: Call[] = [
      {
        contractAddress: allowedMethodContractAddress,
        entrypoint: "some_method",
        calldata: ["0x123"],
      },
    ]

    vi.spyOn(
      argentSessionService.argentService,
      "signSessionEFO",
    ).mockImplementation(async () => ({
      publicKey: "0x123",
      r: 10n,
      s: 10n,
    }))

    const { signature, outsideExecutionTypedData } =
      await argentSessionService.getOutsideExecutionTypedData(
        sessionRequest,
        sessionAuthorizationSignature,
        false,
        calls,
        address,
        "",
        execute_after,
        execute_before,
        nonce,
        "2",
      )

    expect(signature).toBeInstanceOf(Array)
    expect(outsideExecutionTypedData).toStrictEqual(
      outsideExecutionTypedDataFixture_v2(allowedMethodContractAddress),
    )
  })
})
