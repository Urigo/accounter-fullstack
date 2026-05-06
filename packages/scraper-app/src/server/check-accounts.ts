import type {
  HapoalimAccountData,
  HapoalimForeignTransactionsBusiness,
  HapoalimForeignTransactionsPersonal,
  HapoalimILSTransactions,
  IsracardCardsTransactionsList,
  SwiftTransactions,
} from '@accounter/modern-poalim-scraper';
import type { CalPayload } from './payload-schemas/cal.schema.js';
import type { DiscountPayload } from './payload-schemas/discount.schema.js';
import type { MaxPayload } from './payload-schemas/max.schema.js';
import type { AccountRecord } from './vault.js';

export type SourceType = 'poalim' | 'discount' | 'isracard' | 'amex' | 'cal' | 'max';

export type ValidatedPayload =
  | HapoalimAccountData[number]
  | HapoalimILSTransactions
  | HapoalimForeignTransactionsPersonal
  | HapoalimForeignTransactionsBusiness
  | SwiftTransactions
  | DiscountPayload
  | IsracardCardsTransactionsList
  | CalPayload
  | MaxPayload;

export type { AccountRecord } from './vault.js';

export type AccountCheckResult = { accepted: string[]; ignored: string[]; unknown: string[] };

export function extractAccountIdentifiers(type: SourceType, payload: ValidatedPayload): string[] {
  switch (type) {
    case 'poalim': {
      const p = payload as HapoalimAccountData[number];
      if (!('accountNumber' in p) || !('branchNumber' in p)) {
        return [];
      }
      return [`${p.branchNumber}-${p.accountNumber}`];
    }
    case 'discount': {
      const p = payload as DiscountPayload;
      return [...new Set(p.map(entry => entry.accountNumber))];
    }
    case 'isracard':
    case 'amex': {
      const p = payload as IsracardCardsTransactionsList;
      return p.CardsTransactionsListBean.cardNumberList
        .map(c => c.match(/\d{4}/)?.[0])
        .filter((c): c is string => c !== undefined);
    }
    case 'cal': {
      const p = payload as CalPayload;
      return [...new Set(p.map(entry => entry.card))];
    }
    case 'max': {
      const p = payload as MaxPayload;
      return [...new Set(p.map(account => account.accountNumber))];
    }
  }
}

export function checkAccounts(
  type: SourceType,
  payload: ValidatedPayload,
  known: AccountRecord[],
): AccountCheckResult {
  const identifiers = extractAccountIdentifiers(type, payload);
  const accepted: string[] = [];
  const ignored: string[] = [];
  const unknown: string[] = [];

  for (const id of identifiers) {
    const record = known.find(a => a.sourceType === type && a.accountNumber === id);
    if (!record) {
      unknown.push(id);
    } else if (record.status === 'ignored') {
      ignored.push(id);
    } else if (record.status === 'accepted') {
      accepted.push(id);
    } else {
      // 'pending' and any future unrecognized status blocks the run
      unknown.push(id);
    }
  }

  return { accepted, ignored, unknown };
}
