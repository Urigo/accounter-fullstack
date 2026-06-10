import { Currency } from '../gql/graphql.js';

type FinancialAmount = { raw: number; formatted: string; currency: Currency };

export function formatFinancialAmount(
  rawAmount: number,
  currency: Currency = Currency.Ils,
): FinancialAmount {
  return {
    raw: rawAmount,
    formatted: `${currency} ${rawAmount.toFixed(2)}`,
    currency,
  };
}
