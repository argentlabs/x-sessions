# Sessions

Sessions can be used to send transactions from a dapp on behalf of a user without requiring their confirmation with a wallet.

The user is guaranteed that the dapp can only execute transactions that comply to the policies of the session and until the session expires.

## Installation

```bash
npm install @argent/x-sessions
# or
pnpm add @argent/x-sessions
# or
pnpm add @argent/x-sessions
```

## Demo Dapp

A demo dapp using both sessions and offchain sessions can be found here [https://github.com/argentlabs/session-keys-example-dapp](https://github.com/argentlabs/session-keys-example-dapp)

# Session keys

## Creating an Argent session account

First you need to have a deployed account. This is the account that will authorise the session and interact with the contracts of your dapp.

To sign the session message and create the session account, the method needed is `createSessionAccount`.

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
}

type SessionParams = {
  dappKey?: Uint8Array // this is optional. This sdk generate a dappKey using ec.starkCurve.utils.randomPrivateKey() if not provided
  allowedMethods: AllowedMethod[]
  expiry: bigint
  metaData: SessionMetadata
}
```

The following snippet show how to create and use a session account

```typescript
import {
  SignSessionError,
  SessionParams,
  openSession,
  buildSessionAccount
} from "@argent/x-sessions"
import { ec } from "starknet"

const sessionParams: SessionParams = {
  allowedMethods: [
    {
      "Contract Address": contractAddress,
      selector: "method_selector"
    }
  ],
  expiry: Math.floor(
    (Date.now() + 1000 * 60 * 60 * 24) / 1000
  ) as any, // ie: 1 day
  dappKey: ec.starkCurve.utils.randomPrivateKey(),
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

/* 
// Optional  parameter to use json rpc spec with wallets
const options: CreateSessionOptions = {  useWalletRequestMethods: true }; 
*/

// open session and sign message
const accountSessionSignature = await openSession({
  account: wallet.account,
  sessionParams
  /* wallet, StarknetWindowObject */
  /* options, */
})

// create the session account from the current one that will be used to submit transactions
const sessionRequest = createSessionRequest(
  sessionParams.allowedMethods,
  sessionParams.expiry,
  sessionParams.metaData,
  sessionParams.dappKey
)

const sessionAccount = await buildSessionAccount({
  provider: new RpcProvider({
    nodeUrl: "https://starknet-sepolia.public.blastapi.io/rpc/v0_7",
    chainId: constants.StarknetChainId.SN_SEPOLIA
  }),
  accountSessionSignature: stark.formatSignature(
    accountSessionSignature
  ),
  sessionRequest,
  address, // account address
  dappKey
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
