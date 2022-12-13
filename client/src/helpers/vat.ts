import { Currency, FinancialAmount } from '../gql/graphql.js';

export function formatFinancialAmount(
  rawAmount: number,
  currency: Currency = Currency.Ils,
): FinancialAmount {
  return {
    raw: rawAmount,
    formatted: `${rawAmount.toFixed(2)} ${currency}`,
    currency,
  };
}
