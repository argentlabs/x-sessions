import { HttpResponse, http } from "msw"
import { setupServer } from "msw/node"
import { constants, stark } from "starknet"
import { StarknetChainId } from "starknet-types"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import {
  OutsideExecution,
  getOutsideExecutionTypedData,
} from "../outsideExecution"
import { ArgentSessionService } from "../argentSessionService"
import { ArgentServiceSignatureResponse } from "../sessionTypes"
import { getSessionTypedData } from "../utils"

export const restHandlers = [
  http.post("http://localhost:3000/cosigner/signSession", () => {
    return HttpResponse.json({
      signature: {
        publicKey: "0x123",
        r: "10000000000",
        s: "10000000000",
      },
    })
  }),
  http.post("http://localhost:3000/cosigner/signSessionEFO", () => {
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

describe("ArgentSessionService", () => {
  const pubkey = "0x1234567890abcdef"
  const accountSessionSignature = ["123", "456"]
  const service = new ArgentSessionService(
    pubkey,
    accountSessionSignature,
    "http://localhost:3000",
  )

  // Start server before all tests
  beforeAll(() => server.listen())

  //  Close server after all tests
  afterAll(() => server.close())

  // Reset handlers after each test `important for test isolation`
  afterEach(() => server.resetHandlers())

  describe("signTxAndSession", () => {
    it("should sign the transactions and session and return a argent service signature response", async () => {
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

      const response: ArgentServiceSignatureResponse =
        await service.signTxAndSession(
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

  describe("signOutsideTxAndSession", () => {
    it("should sign the outside session and return an argent session signature response", async () => {
      const sessionTokenToSign = {
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
      const accountAddress = "0xabcdef"
      const outsideExecution: OutsideExecution = {
        caller:
          "0x127021a1b5a52d3174c2ab077c2b043c80369250d29428cee956d76ee51584f",
        nonce:
          "0x110fd19c2c7b1cafb8c9ce07490696fa740471a9abb098aa0740b42280626ac",
        execute_after: "0x0",
        execute_before: "0x18fa0858a36",
        calls: [
          {
            to: "0x555",
            selector:
              "0x3e9b0f6055fb776af67e56edb799f3a9a91da582fcec186ed950cdb4ea7f5d9",
            calldata: [
              "0x7e36202ace0ab52bf438bd8a8b64b3731c48d09f0d8879f5b006384c2f35032",
              "0x38d7ea4c68000",
              "0x0",
            ],
          },
          {
            to: "0x666",
            selector:
              "0x12b9402153dd0d28e9dc6f22df346031924a5797f297e27019651a3b53fd40",
            calldata: [
              "0x7e36202ace0ab52bf438bd8a8b64b3731c48d09f0d8879f5b006384c2f35032",
            ],
          },
        ],
      }

      const chainId: StarknetChainId = constants.StarknetChainId.SN_SEPOLIA

      const response: ArgentServiceSignatureResponse =
        await service.signSessionEFO(
          sessionTokenToSign,
          accountAddress,
          getOutsideExecutionTypedData(outsideExecution, chainId),
          [123n, 456n],
          false,
          chainId,
        )

      expect(response).toStrictEqual({
        publicKey: "0x123",
        r: "10000000000",
        s: "10000000000",
      })
    })
  })
})
