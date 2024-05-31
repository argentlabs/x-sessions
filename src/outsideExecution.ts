import {
  ArraySignatureType,
  Call,
  CallData,
  RawArgs,
  SignerInterface,
  hash,
  num,
  typedData,
  type Provider,
  type ProviderInterface,
} from "starknet"
import { StarknetChainId, TypedData } from "starknet-types"

export const typesRev1 = {
  StarknetDomain: [
    { name: "name", type: "shortstring" },
    { name: "version", type: "shortstring" },
    { name: "chainId", type: "shortstring" },
    { name: "revision", type: "shortstring" },
  ],
  OutsideExecution: [
    { name: "Caller", type: "ContractAddress" },
    { name: "Nonce", type: "felt" },
    { name: "Execute After", type: "u128" },
    { name: "Execute Before", type: "u128" },
    { name: "Calls", type: "Call*" },
  ],
  Call: [
    { name: "To", type: "ContractAddress" },
    { name: "Selector", type: "selector" },
    { name: "Calldata", type: "felt*" },
  ],
}

function getDomain(chainId: string) {
  // WARNING! Version and revision are encoded as numbers in the StarkNetDomain type and not as shortstring
  // This is due to a bug in the Braavos implementation, and has been kept for compatibility
  return {
    name: "Account.execute_from_outside",
    version: "1",
    chainId: chainId,
    revision: "1",
  }
}

export interface OutsideExecution {
  caller: string
  nonce: num.BigNumberish
  execute_after: num.BigNumberish
  execute_before: num.BigNumberish
  calls: OutsideCall[]
}

export interface OutsideCall {
  to: string
  selector: num.BigNumberish
  calldata: RawArgs
}

export function getOutsideCall(call: Call): OutsideCall {
  return {
    to: call.contractAddress,
    selector: hash.getSelectorFromName(call.entrypoint),
    calldata: call.calldata ?? [],
  }
}

export function getTypedDataHash(
  outsideExecution: OutsideExecution,
  accountAddress: num.BigNumberish,
  chainId: string,
): string {
  return typedData.getMessageHash(
    getOutsideExecutionTypedData(outsideExecution, chainId),
    accountAddress,
  )
}

export function getOutsideExecutionTypedData(
  outsideExecution: OutsideExecution,
  chainId: string,
) {
  return {
    types: typesRev1,
    primaryType: "OutsideExecution",
    domain: getDomain(chainId),
    message: {
      Caller: outsideExecution.caller,
      Nonce: outsideExecution.nonce,
      "Execute After": outsideExecution.execute_after,
      "Execute Before": outsideExecution.execute_before,
      Calls: outsideExecution.calls.map((call) => {
        return {
          To: call.to,
          Selector: call.selector,
          Calldata: call.calldata,
        }
      }),
    },
  }
}

export async function getOutsideExecutionCall(
  outsideExecution: OutsideExecution,
  accountAddress: string,
  signer: SignerInterface,
  provider: ProviderInterface | Provider,
  chainId?: StarknetChainId,
): Promise<Call> {
  chainId = chainId ?? (await provider.getChainId())
  const currentTypedData = getOutsideExecutionTypedData(
    outsideExecution,
    chainId,
  )
  const signature = await signer.signMessage(currentTypedData, accountAddress)
  return {
    contractAddress: accountAddress,
    entrypoint: "execute_from_outside_v2",
    calldata: CallData.compile({ ...outsideExecution, signature }),
  }
}

export type OutsideExecutionTypedData = ReturnType<
  typeof getOutsideExecutionTypedData
>

export type OutsideExecutionTypedDataResponse = {
  signature: ArraySignatureType
  outsideExecutionTypedData: TypedData
}
