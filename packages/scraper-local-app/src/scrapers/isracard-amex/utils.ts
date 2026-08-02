import type { CreditcardType } from './index.js';

export function getTableName(accountType: CreditcardType): string {
  if (accountType === 'ISRACARD') return 'isracard_creditcard_transactions';
  if (accountType === 'AMEX') return 'amex_creditcard_transactions';
  throw new Error(`Unknown creditcard type: ${accountType}`);
}

/**
 * Add random human-like delay
 */
export function randomDelay(min: number = 3000, max: number = 5000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}
