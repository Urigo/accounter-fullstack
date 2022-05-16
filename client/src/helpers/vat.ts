import { Currency, FinancialAmount } from '../__generated__/types';

export function formatFinancialAmount(rawAmount: number, currency: Currency = Currency.Nis): FinancialAmount {
  return {
    raw: rawAmount,
    formatted: `${rawAmount.toFixed(2)} ${currency}`,
    currency,
  };
}
