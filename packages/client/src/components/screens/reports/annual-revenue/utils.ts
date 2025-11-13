import type { Currency } from '@/gql/graphql.js';
import { getCurrencyFormatter } from '@/helpers/index.js';

export const formatCurrency = (amount: number, currency: Currency) => {
  return getCurrencyFormatter(currency, {
    minimumFractionDigits: 0,
  }).format(amount);
};
