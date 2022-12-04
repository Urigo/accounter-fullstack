import { Currency, FinancialAmount } from '../__generated__/types.js';

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
