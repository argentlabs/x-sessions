export const outsideExecutionTypedDataFixture = (to: string) => ({
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
    "Execute After": 1,
    "Execute Before": 999999999999999,
    Nonce: "0x1",
    Calls: [
      {
        Selector:
          "0x2f043e3dd744a94c4afd9d35321851d44c14a01fa5b2b8a05e054b12e5cc838",
        To: to,
        Calldata: ["0x123"],
      },
    ],
  },
})
