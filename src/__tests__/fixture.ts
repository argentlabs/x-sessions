export const executionFromOusideTypedData = {
  types: {
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
  },
  primaryType: "OutsideExecution",
  domain: {
    name: "Account.execute_from_outside",
    version: "1",
    chainId: "0x534e5f5345504f4c4941",
    revision: "1",
  },
  message: {
    Caller: "0x414e595f43414c4c4552",
    Nonce: "0x0798ef92039d573fd2bddebf8fb6e3f9433b427599c6a197a257c56217ed0028",
    "Execute After": 1717083421,
    "Execute Before": 1717085221,
    Calls: [
      {
        To: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
        Selector:
          "0x83afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e",
        Calldata: [
          "1115436151010850222370456021034097286288953072150521336144416303332438939902",
          "100000",
          "0",
        ],
      },
    ],
  },
}
