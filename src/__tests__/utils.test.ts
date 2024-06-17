import {
  Account,
  RpcProvider,
  constants,
  ec,
  shortString,
  stark,
} from "starknet"
import { StarknetWindowObject } from "starknet-types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  AllowedMethod,
  DappKey,
  SessionMetadata,
  SessionParams,
} from "../sessionTypes"
import {
  buildSessionAccount,
  createSessionRequest,
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

const contractAddress = stark.randomAddress()
const allowedMethods: AllowedMethod[] = [
  {
    "Contract Address": contractAddress,
    selector: "some_method",
  },
]
const expiry = BigInt(1234567890)
const metadata: SessionMetadata = {
  projectID: "test",
  txFees: [{ tokenAddress: stark.randomAddress(), maxAmount: "1000000000000" }],
}
const signerPublicKey = "0x123"
const chainId = constants.StarknetChainId.SN_SEPOLIA

describe("Utils", () => {
  let dappKey: DappKey

  beforeEach(() => {
    const privateDappKey = ec.starkCurve.utils.randomPrivateKey()
    const publicDappKey = ec.starkCurve.getStarkKey(privateDappKey)
    dappKey = {
      privateKey: privateDappKey,
      publicKey: publicDappKey,
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

  describe("createSessionRequest", () => {
    it("should return an OffChainSession object", () => {
      const sessionRequest = createSessionRequest(
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
    it("should throw error if publicDappKey is not provided", async () => {
      const sessionParams: SessionParams = {
        allowedMethods,
        expiry,
        metaData: metadata,
        publicDappKey: "",
      }

      await expect(
        openSession({
          wallet: walletMock as StarknetWindowObject,
          sessionParams,
          chainId,
        }),
      ).rejects.toThrowError("publicDappKey is required")
    })

    /* it("should open a session using an Account", async () => {
      const sessionParams: SessionParams = {
        allowedMethods,
        expiry,
        metaData: metadata,
        publicDappKey: dappKey.publicKey,
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
        publicDappKey: dappKey.publicKey,
      }

      const accountSessionSignature = await openSession({
        wallet: walletMock as StarknetWindowObject,
        sessionParams,
        chainId,
      })

      expect(accountSessionSignature).not.toBeNull()
      expect(accountSessionSignature).toStrictEqual(["0x123", "0x456"])
    })
  })

  describe("buildSessionAccount", () => {
    it("should return an Account object", async () => {
      const useCacheAuthorisation = false
      const sessionRequest = createSessionRequest(
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
        sessionRequest,
        provider,
        chainId,
        address,
        dappKey,
      })

      expect(result).toBeInstanceOf(Account)
    })
  })
})
