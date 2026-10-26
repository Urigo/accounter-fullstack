/** Synthetic executions for the securities tables' tests — never lifted from a real bank capture */

export function securityAccount(accountNumber: number, name: string | null = null) {
  return {
    id: `12-600-${accountNumber}`,
    bankNumber: 12,
    branchNumber: 600,
    accountNumber,
    financialAccount: name ? { id: `financial-account-${accountNumber}`, name } : null,
  };
}

/** A `SecurityExecutionFields` result: a buy of 10 units in the given account */
export function securityExecution(
  id: string,
  account: ReturnType<typeof securityAccount>,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    tradeDate: '2024-03-10',
    valueDate: '2024-03-12',
    settlementDate: null,
    tradeType: 'BUY',
    transactionType: 'BUY',
    paymentType: null,
    quantity: 10,
    tradePrice: 100,
    tradeGrossValue: { formatted: '$1,000.00' },
    netValue: { formatted: '$ -1,000.00' },
    tradeCommission: null,
    managementFees: null,
    israelTaxValue: null,
    foreignTaxValue: null,
    israelTaxValueByPayments: null,
    capitalTaxValue: null,
    account,
    transferCounterpart: null,
    ...overrides,
  };
}
