import type { StarknetWindowObject } from "get-starknet-core"

import { AccountInterface, Signature } from "starknet"

export type Hex = `0x${string}`

export interface GasFees {
  tokenAddress: Hex
  maximumAmount: {
    low: Hex
    high: Hex
  }
}

export interface OffchainSessionAllowedMethods {
  contractAddress: Hex
  method: string
}

export interface OffchainRequestSession {
  sessionKey: string
  expirationTime: number
  allowedMethods: OffchainSessionAllowedMethods[]
}

export async function createOffchainSessionV5(
  session: OffchainRequestSession,
  account: AccountInterface,
  gasFees: GasFees,
  version = "1",
): Promise<Signature> {
  const { sessionKey, expirationTime, allowedMethods } = session
  const chainId = await account.getChainId()
  const signature = await account.signMessage({
    domain: {
      name: "ArgentSession",
      chainId,
      version,
    },
    types: {
      Session: [
        {
          name: "accountAddress",
          type: "felt",
        },
        {
          name: "sessionKey",
          type: "felt",
        },
        {
          name: "expirationTime",
          type: "felt",
        },
        {
          name: "gasFees",
          type: "TokenSpending",
        },
        {
          name: "allowedMethods",
          type: "AllowedMethod*",
        },
      ],
      TokenSpending: [
        {
          name: "tokenAddress",
          type: "felt",
        },
        {
          name: "maximumAmount",
          type: "u256",
        },
      ],
      AllowedMethod: [
        {
          name: "contractAddress",
          type: "felt",
        },
        {
          name: "method",
          type: "felt",
        },
      ],
      u256: [
        {
          name: "low",
          type: "felt",
        },
        {
          name: "high",
          type: "felt",
        },
      ],
      StarkNetDomain: [
        { name: "name", type: "felt" },
        { name: "chainId", type: "felt" },
        { name: "version", type: "felt" },
      ],
    },
    primaryType: "Session",
    message: {
      accountAddress: account.address,
      sessionKey,
      expirationTime,
      gasFees,
      allowedMethods,
    },
  })
  return signature
}

export async function createOffchainSession(
  wallet: StarknetWindowObject,
  session: OffchainRequestSession,
  account: AccountInterface,
  gasFees: GasFees,
  version = "1",
): Promise<Signature> {
  const { sessionKey, expirationTime, allowedMethods } = session
  const chainId = await account.getChainId()
  const signature = await wallet.request({
    type: "starknet_signTypedData",
    params: {
      domain: {
        name: "ArgentSession",
        chainId,
        version,
      },
      types: {
        Session: [
          {
            name: "accountAddress",
            type: "felt",
          },
          {
            name: "sessionKey",
            type: "felt",
          },
          {
            name: "expirationTime",
            type: "felt",
          },
          {
            name: "gasFees",
            type: "TokenSpending",
          },
          {
            name: "allowedMethods",
            type: "AllowedMethod*",
          },
        ],
        TokenSpending: [
          {
            name: "tokenAddress",
            type: "felt",
          },
          {
            name: "maximumAmount",
            type: "u256",
          },
        ],
        AllowedMethod: [
          {
            name: "contractAddress",
            type: "felt",
          },
          {
            name: "method",
            type: "felt",
          },
        ],
        u256: [
          {
            name: "low",
            type: "felt",
          },
          {
            name: "high",
            type: "felt",
          },
        ],
        StarkNetDomain: [
          { name: "name", type: "felt" },
          { name: "chainId", type: "felt" },
          { name: "version", type: "felt" },
        ],
      },
      primaryType: "Session",
      message: {
        accountAddress: account.address,
        sessionKey,
        expirationTime,
        gasFees,
        allowedMethods,
      },
    },
  })

  return signature
}
