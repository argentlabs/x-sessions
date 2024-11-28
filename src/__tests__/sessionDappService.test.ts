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
import {
  outsideExecutionTypedDataFixture,
  outsideExecutionTypedDataFixture_v2,
} from "./fixture"
import { SessionAccount } from "../SessionAccount"
import * as sessionMethods from "../sessionUtils"
import * as argentBeMethods from "../argentBackendUtils"
import {
  createOutsideExecutionCall,
  createOutsideExecutionTypedData,
} from "../outsideExecution"
import { SessionKey } from "dist/session.types"

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
const authorisationSignature = ["0x123", "0x456"]
const accountSessionAddress = "0x123456"

const privateKey = ec.starkCurve.utils.randomPrivateKey()

const sessionKey: SessionKey = {
  privateKey,
  publicKey: ec.starkCurve.getStarkKey(privateKey),
}

const session = {
  address: accountSessionAddress,
  allowedMethods: sessionRequest.allowed_methods,
  authorisationSignature,
  expiresAt: sessionRequest.expires_at,
  chainId: constants.StarknetChainId.SN_SEPOLIA,
  hash: "0x123",
  metadata: sessionRequest.metadata,
  sessionKeyGuid: sessionRequest.session_key_guid,
  version: "1",
  sessionKey,
}

describe("SessionDappService", () => {
  beforeAll(async () => {
    vi.spyOn(sessionMethods, "signTxAndSession").mockImplementation(() => [
      10n,
      10n,
    ])

    vi.spyOn(argentBeMethods, "argentSignTxAndSession").mockImplementation(
      async () => ({
        publicKey: "0x123",
        r: 10n,
        s: 10n,
      }),
    )

    vi.spyOn(argentBeMethods, "argentSignSessionEFO").mockImplementation(
      async () => ({
        publicKey: "0x123",
        r: 10n,
        s: 10n,
      }),
    )
  })

  it("should get an account with session signer", async () => {
    const provider = new RpcProvider()

    const account = new SessionAccount(session, sessionKey)

    expect(
      account.getAccountWithSessionSigner({ provider, session }),
    ).toBeInstanceOf(Account)
  })

  it("should signTransaction calling argent session service", async () => {
    const invokationDetails: V2InvocationsSignerDetails = {
      cairoVersion: "1",
      chainId: constants.StarknetChainId.SN_SEPOLIA,
      maxFee: 1000n,
      nonce: 1,
      version: "0x2",
      walletAddress: stark.randomAddress(),
    }

    const account = new SessionAccount(session, sessionKey)

    const signatureResult: any = await (account as any).signTransaction(
      authorisationSignature,
      session,
      [],
      invokationDetails,
      cacheAuthorisation,
    )

    expect(signatureResult).toBeInstanceOf(Array)
    expect(sessionMethods.signTxAndSession).toHaveBeenCalled()
    expect(sessionMethods.signTxAndSession).toReturnWith([10n, 10n])
  })

  it("should get an outside execution call with getOutsideExecutionCall", async () => {
    const provider = new RpcProvider()
    vi.spyOn(provider, "getChainId").mockImplementation(
      async () => constants.StarknetChainId.SN_SEPOLIA,
    )
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

    const outsideExecutionCall = await createOutsideExecutionCall({
      session,
      sessionKey,
      cacheAuthorisation,
      calls,
      outsideExecutionParams: {
        caller,
        execute_after,
        execute_before,
      },
    })

    expect(outsideExecutionCall.entrypoint).toEqual("execute_from_outside_v2")
    expect(outsideExecutionCall.contractAddress).toEqual(accountSessionAddress)
    expect(outsideExecutionCall.calldata).toBeInstanceOf(Array)
    expect(outsideExecutionCall.calldata).not.toBe([])
  })

  it("should get an outside execution call with getOutsideExecutionTypedData", async () => {
    const provider = new RpcProvider()
    vi.spyOn(provider, "getChainId").mockImplementation(
      async () => constants.StarknetChainId.SN_SEPOLIA,
    )
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

    const { signature, outsideExecutionTypedData } =
      await createOutsideExecutionTypedData({
        session,
        sessionKey,
        cacheAuthorisation,
        calls,
        outsideExecutionParams: {
          execute_after,
          execute_before,
          nonce,
        },
      })

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

    const { signature, outsideExecutionTypedData } =
      await createOutsideExecutionTypedData({
        session,
        sessionKey,
        cacheAuthorisation,
        calls,
        outsideExecutionParams: {
          execute_after,
          execute_before,
          nonce,
          version: "2",
        },
      })

    expect(signature).toBeInstanceOf(Array)
    expect(outsideExecutionTypedData).toStrictEqual(
      outsideExecutionTypedDataFixture_v2(allowedMethodContractAddress),
    )
  })
})
