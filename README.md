# Sessions

Sessions can be used to send transactions from a dapp on behalf of a user without requiring their confirmation with a wallet.

The user is guaranteed that the dapp can only execute transactions that comply to the policies of the session and until the session expires.

## Installation

```bash
npm install @argent/x-sessions
# or
pnpm add @argent/x-sessions
```

## Demo Dapp

A demo dapp using both sessions and offchain sessions can be found here [https://github.com/argentlabs/session-keys-example-dapp](https://github.com/argentlabs/session-keys-example-dapp)

# Session keys

## Creating an Argent session account

First you need to have a deployed account. This is the account that will authorise the session and interact with the contracts of your dapp.

To sign the session message the method needed is `createSession`. After the user sign the message, a session account can be created using `buildSessionAccount`.

This example session will allow the dapp to execute an example endpoint on an example contract without asking the user to approve the transaction again. After signing the session the dapp can execute all transactions listed in `allowedMethods` whenever it wants and as many times as it wants.

**The list of allowedMethods needs to be communicated with Argent, in order to be whitelisted.**

```typescript
export interface AllowedMethod {
  "Contract Address": string
  selector: string
}

export type MetadataTxFee = {
  tokenAddress: string
  maxAmount: string
}

export type SessionMetadata = {
  projectID: string
  txFees: MetadataTxFee[]
  projectSignature?: Signature
}

type CreateSessionParams = {
  sessionKey?: Uint8Array // this is optional. This sdk generate a sessionKey using ec.starkCurve.utils.randomPrivateKey() if not provided
  allowedMethods: AllowedMethod[]
  expiry: bigint
  metaData: SessionMetadata
}
```

The following snippet show how to create and use a session account

```typescript
import {
  SignSessionError,
  CreateSessionParams,
  createSession,
  buildSessionAccount,
  bytesToHexString
} from "@argent/x-sessions"
import { ec } from "starknet"

const privateKey = ec.starkCurve.utils.randomPrivateKey()

const sessionKey: SessionKey = {
  privateKey: bytesToHexString(privateKey),
  publicKey: ec.starkCurve.getStarkKey(privateKey)
}

const sessionParams: CreateSessionParams = {
  sessionKey,
  allowedMethods: [
    {
      "Contract Address": contractAddress,
      selector: "method_selector"
    }
  ],
  expiry: Math.floor(
    (Date.now() + 1000 * 60 * 60 * 24) / 1000
  ) as any, // ie: 1 day
  sessionKey: ec.starkCurve.utils.randomPrivateKey(),
  metaData: {
    projectID: "test-dapp",
    txFees: [
      {
        tokenAddress: ETHTokenAddress,
        maxAmount: parseUnits("0.1", 18).value.toString()
      }
    ]
  }
}

// create the session request to get the typed data to be signed
const sessionRequest = createSessionRequest({
  sessionParams,
  chainId
})

// wallet is a StarknetWindowObject
const authorisationSignature = await wallet.request({
  type: "wallet_signTypedData",
  params: sessionRequest.sessionTypedData
})

// open session and sign message
const session = await createSession({
  sessionRequest, // SessionRequest
  address, // Account address
  chainId, // StarknetChainId
  authorisationSignature // Signature
})

const sessionAccount = await buildSessionAccount({
  useCacheAuthorisation: false, // optional and defaulted to false, will be added in future developments
  session,
  sessionKey,
  provider: new RpcProvider({
    nodeUrl: "https://starknet-sepolia.public.blastapi.io/rpc/v0_7",
    chainId: constants.StarknetChainId.SN_SEPOLIA
  }),
  argentSessionServiceBaseUrl: ARGENT_SESSION_SERVICE_BASE_URL // Optional: defaulted to mainnet url
})

try {
  const tx = sessionAccount.execute({
    // lets assume this is a erc20 contract
    contractAddress: "0x...",
    selector: "transfer",
    calldata: [
      "0x..."
      // ...
    ]
  })
} catch (e) {
  console.error((e as SignSessionError).cause, e.message)
}
```

## Execute from outside

Executing transactions “from outside” allows an account to submit transactions on behalf of a user account, as long as they have the relevant signatures.

This package expose a method in order to get the Call required to perform an execution from outside.

```typescript
const privateKey = ec.starkCurve.utils.randomPrivateKey()

const sessionKey: SessionKey = {
  privateKey: bytesToHexString(privateKey),
  publicKey: ec.starkCurve.getStarkKey(privateKey)
}

const sessionParams: CreateSessionParams = {
  sessionKey,
  allowedMethods: [
    {
      "Contract Address": contractAddress,
      selector: "method_selector"
    }
  ],
  expiry: Math.floor(
    (Date.now() + 1000 * 60 * 60 * 24) / 1000
  ) as any, // ie: 1 day
  sessionKey: ec.starkCurve.utils.randomPrivateKey(),
  metaData: {
    projectID: "test-dapp",
    txFees: [
      {
        tokenAddress: ETHTokenAddress,
        maxAmount: parseUnits("0.1", 18).value.toString()
      }
    ]
  }
}

// create the session request to get the typed data to be signed
const sessionRequest = createSessionRequest({
  sessionParams,
  chainId
})

// wallet is a StarknetWindowObject
const authorisationSignature = await wallet.request({
  type: "wallet_signTypedData",
  params: sessionRequest.sessionTypedData
})

// open session and sign message
const session = await createSession({
  sessionRequest, // SessionRequest
  address, // Account address
  chainId, // StarknetChainId
  authorisationSignature // Signature
})

const sessionAccount = await buildSessionAccount({
  useCacheAuthorisation: false, // optional and defaulted to false, will be added in future developments
  session,
  sessionKey,
  provider: new RpcProvider({
    nodeUrl: "https://starknet-sepolia.public.blastapi.io/rpc/v0_7",
    chainId: constants.StarknetChainId.SN_SEPOLIA
  }),
  argentSessionServiceBaseUrl: ARGENT_SESSION_SERVICE_BASE_URL // Optional: defaulted to mainnet url
})

// example for creating the calldata
const erc20Contract = new Contract(
  Erc20Abi as Abi,
  ETHTokenAddress,
  sessionAccount
)
const calldata = erc20Contract.populate("transfer", {
  recipient: address,
  amount: parseInputAmountToUint256(amount)
})

// get execute from outside data
const { contractAddress, entrypoint, calldata } =
  await createOutsideExecutionCall({
    session,
    sessionKey,
    calls: [transferCallData],
    argentSessionServiceUrl: ARGENT_SESSION_SERVICE_BASE_URL
  })

const { signature, outsideExecutionTypedData } =
  await createOutsideExecutionTypedData({
    session,
    sessionKey,
    calls: [transferCallData],
    argentSessionServiceUrl: ARGENT_SESSION_SERVICE_BASE_URL
  })
```
