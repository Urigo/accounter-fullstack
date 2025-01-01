import type { CreditcardType } from './index.js';

export function getTableName(accountType: CreditcardType): string {
  if (accountType === 'ISRACARD') return 'isracard_creditcard_transactions';
  if (accountType === 'AMEX') return 'amex_creditcard_transactions';
  throw new Error(`Unknown creditcard type: ${accountType}`);
}
