import { HttpResponse, http } from "msw"
import { setupServer } from "msw/node"
import { constants, stark } from "starknet"
import { StarknetChainId } from "starknet-types"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { ArgentBackendSessionService } from "../sessionBackendService"
import { BackendSignatureResponse } from "../sessionTypes"
import { getSessionTypedData } from "../utils"

export const restHandlers = [
  http.post("https://api.hydrogen.argent47.net/v1/cosigner/signSession", () => {
    return HttpResponse.json({
      signature: {
        publicKey: "0x123",
        r: "10000000000",
        s: "10000000000",
      },
    })
  }),
]

const server = setupServer(...restHandlers)

describe("ArgentBackendSessionService", () => {
  const pubkey = "0x1234567890abcdef"
  const accountSessionSignature = ["123", "456"]
  const service = new ArgentBackendSessionService(
    pubkey,
    accountSessionSignature,
  )

  // Start server before all tests
  beforeAll(() => server.listen())

  //  Close server after all tests
  afterAll(() => server.close())

  // Reset handlers after each test `important for test isolation`
  afterEach(() => server.resetHandlers())

  describe("getApiBaseUrl", () => {
    it("should return the correct API base URL for the given chain ID", () => {
      const testBaseUrl = (service as any).getApiBaseUrl(
        constants.StarknetChainId.SN_SEPOLIA,
      )
      const prodBaseUrl = (service as any).getApiBaseUrl(
        constants.StarknetChainId.SN_MAIN,
      )
      expect(testBaseUrl).toBe("https://api.hydrogen.argent47.net/v1")
      expect(prodBaseUrl).toBe("https://cloud.argent-api.com/v1")
    })
  })

  describe("signTxAndSession", () => {
    it("should sign the transactions and session and return a backend signature response", async () => {
      const cacheAuthorisation = false

      const sessionRequest = {
        expires_at: 1234567890,
        allowed_methods: [
          {
            "Contract Address": stark.randomAddress(),
            selector: "set_number_double",
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

      const sessionTypedData = getSessionTypedData(
        sessionRequest,
        StarknetChainId.SN_SEPOLIA,
      )

      const response: BackendSignatureResponse = await service.signTxAndSession(
        [],
        {
          cairoVersion: "1",
          chainId: StarknetChainId.SN_SEPOLIA,
          maxFee: 1000n,
          nonce: 1,
          version: "0x2",
          walletAddress: stark.randomAddress(),
        },
        sessionTypedData,
        [10n, 20n],
        cacheAuthorisation,
      )

      expect(response).toEqual({
        publicKey: "0x123",
        r: "10000000000",
        s: "10000000000",
      })

      // Assert the response here
    })
  })

  /*  describe("signOutsideTxAndSession", () => {
    it("should sign the outside session and return a backend signature response", async () => {
      const sessionTokenToSign: OffChainSession = {
        // Define your off-chain session token here
      }
      const accountAddress = "0xabcdef"
      const outsideExecution: OutsideExecution = {
        // Define your outside execution details here
      }
      const revision: TypedDataRevision = "v1"
      const chainId: StarknetChainId = constants.StarknetChainId.TESTNET

      const response: BackendSignatureResponse =
        await service.signOutsideTxAndSession(
          sessionTokenToSign,
          accountAddress,
          outsideExecution,
          revision,
          chainId,
        )

      // Assert the response here
    })
  }) */
})
