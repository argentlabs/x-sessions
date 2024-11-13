import { Account, RpcProvider, constants, shortString, stark } from "starknet"
import { StarknetWindowObject } from "@starknet-io/types-js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  AllowedMethod,
  SessionKey,
  SessionMetadata,
  SessionParams,
} from "../sessionTypes"
import {
  buildSessionAccount,
  createOffchainSession,
  getSessionDomain,
  getSessionTypedData,
  openSession,
} from "../utils"

type WalletMock = Pick<StarknetWindowObject, "request">

export const walletMock: WalletMock = {
  request: async (request) => {
    switch (request.type) {
      case "wallet_signTypedData":
        return ["0x123", "0x456"]
      default:
        return undefined as any
    }
  },
}

const contractAddress = "0x123456789"
const tokenAddress = "0x987654321"
const allowedMethods: AllowedMethod[] = [
  {
    "Contract Address": contractAddress,
    selector: "some_method",
  },
]
const expiry = BigInt(1234567890)
const metadata: SessionMetadata = {
  projectID: "test",
  txFees: [{ tokenAddress, maxAmount: "1000000000000" }],
}
const signerPublicKey = "0x123"
const chainId = constants.StarknetChainId.SN_SEPOLIA

describe("Utils", () => {
  let sessionKey: SessionKey

  beforeEach(() => {
    const privateSessionKey = new Uint8Array([1, 2, 3, 4, 5])
    const publicSessionKey = "0x1234567890abcdef"
    sessionKey = {
      privateKey: privateSessionKey,
      publicKey: publicSessionKey,
    }
  })

  describe("getSessionDomain", () => {
    it("should return a StarknetDomain object", () => {
      const result = getSessionDomain(chainId)
      expect(result).toEqual({
        name: "SessionAccount.session",
        version: "0x31",
        chainId,
        revision: "1",
      })
    })
  })

  describe("getSessionTypedData", () => {
    it("should return a TypedData object", () => {
      const sessionRequest = {
        expires_at: 1234567890,
        allowed_methods: [],
        metadata: JSON.stringify(metadata),
        session_key_guid:
          "0x116dcea0b31d06f721c156324cd8de3652bf8953cd5ba055f74db21b1134ec9",
      }

      const sessionTypedData = getSessionTypedData(sessionRequest, chainId)
      expect(sessionTypedData).toStrictEqual({
        types: {
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
            {
              name: "Allowed Methods",
              type: "merkletree",
              contains: "Allowed Method",
            },
            { name: "Metadata", type: "string" },
            { name: "Session Key", type: "felt" },
          ],
        },
        primaryType: "Session",
        domain: {
          name: "SessionAccount.session",
          version: shortString.encodeShortString("1"),
          chainId,
          revision: "1",
        },
        message: {
          "Expires At": sessionRequest.expires_at,
          "Allowed Methods": sessionRequest.allowed_methods,
          Metadata: sessionRequest.metadata,
          "Session Key": sessionRequest.session_key_guid,
        },
      })
    })
  })

  describe("createOffchainSession", () => {
    it("should return an OffChainSession object", () => {
      const sessionRequest = createOffchainSession(
        allowedMethods,
        expiry,
        metadata,
        signerPublicKey,
      )

      expect(sessionRequest).toEqual({
        expires_at: 1234567890,
        allowed_methods: [
          {
            "Contract Address": contractAddress,
            selector: "some_method",
          },
        ],
        metadata: JSON.stringify(metadata),
        session_key_guid:
          "0x116dcea0b31d06f721c156324cd8de3652bf8953cd5ba055f74db21b1134ec9",
      })
    })
  })

  describe("openSession", () => {
    it("should throw error if publicSessionKey is not provided", async () => {
      const sessionParams: SessionParams = {
        allowedMethods,
        expiry,
        metaData: metadata,
        publicSessionKey: "",
      }

      await expect(
        openSession({
          wallet: walletMock as StarknetWindowObject,
          sessionParams,
          chainId,
        }),
      ).rejects.toThrowError("publicSessionKey is required")
    })

    /* it("should open a session using an Account", async () => {
      const sessionParams: SessionParams = {
        allowedMethods,
        expiry,
        metaData: metadata,
        publicSessionKey: sessionKey.publicKey,
      }

      const account = new Account(
        new RpcProvider(),
        stark.randomAddress(),
        ec.starkCurve.utils.randomPrivateKey(),
      )

      vi.spyOn(account, "signMessage").mockImplementation(async () => [
        "0x123",
        "0x456",
      ])

      const accountSessionSignature = await openSession({
        account,
        sessionParams,
        chainId,
      })

      expect(accountSessionSignature).not.toBeNull()
      expect(accountSessionSignature).toStrictEqual(["0x123", "0x456"])
    }) */

    it("should open a session using wallet rpc methods", async () => {
      const sessionParams: SessionParams = {
        allowedMethods,
        expiry,
        metaData: metadata,
        publicSessionKey: sessionKey.publicKey,
      }

      const accountSessionSignature = await openSession({
        wallet: walletMock as StarknetWindowObject,
        sessionParams,
        chainId,
      })

      expect(accountSessionSignature).not.toBeNull()
      expect(accountSessionSignature).toStrictEqual({
        accountSessionSignature: ["0x123", "0x456"],
        offchainSession: {
          allowed_methods: [
            {
              "Contract Address": contractAddress,
              selector: "some_method",
            },
          ],
          expires_at: 1234567890,
          metadata: `{"projectID":"test","txFees":[{"tokenAddress":"${tokenAddress}","maxAmount":"1000000000000"}]}`,
          session_key_guid:
            "0x4bef97e579cdb4c9fa3546db3017a69ddbc40598cd7311359f1e6c03f02b155",
        },
      })
    })
  })

  describe("buildSessionAccount", () => {
    it("should return an Account object", async () => {
      const useCacheAuthorisation = false
      const offchainSession = createOffchainSession(
        allowedMethods,
        expiry,
        metadata,
        signerPublicKey,
      )

      const accountSessionSignature = ["0x123", "0x456"]
      const address = stark.randomAddress()

      const provider = new RpcProvider()
      const chainId = constants.StarknetChainId.SN_SEPOLIA
      vi.spyOn(provider, "getChainId").mockImplementation(async () => chainId)

      const result = await buildSessionAccount({
        useCacheAuthorisation,
        accountSessionSignature,
        offchainSession,
        provider,
        chainId,
        address,
        sessionKey,
      })

      expect(result).toBeInstanceOf(Account)
    })
  })
})
