import type { AmexPayload } from './payload-schemas/amex.schema.js';
import type { CalPayload } from './payload-schemas/cal.schema.js';
import type { DiscountPayload } from './payload-schemas/discount.schema.js';
import type { IsracardPayload } from './payload-schemas/isracard.schema.js';
import type { MaxPayload } from './payload-schemas/max.schema.js';
import type { PoalimForeignPayload } from './payload-schemas/poalim-foreign.schema.js';
import type { PoalimIlsPayload } from './payload-schemas/poalim-ils.schema.js';
import type { PoalimSwiftPayload } from './payload-schemas/poalim-swift.schema.js';
import type { BankAccount } from './vault.js';

export type SourceType = 'poalim' | 'discount' | 'isracard' | 'amex' | 'cal' | 'max';

export type ValidatedPayload =
  | PoalimIlsPayload
  | PoalimForeignPayload
  | PoalimSwiftPayload
  | DiscountPayload
  | IsracardPayload
  | AmexPayload
  | CalPayload
  | MaxPayload;

export type AccountRecord = BankAccount;

type CheckResult = { accepted: string[]; ignored: string[]; unknown: string[] };

function extractIdentifiers(type: SourceType, payload: ValidatedPayload): string[] {
  switch (type) {
    case 'poalim': {
      if (!('retrievalTransactionData' in payload)) return [];
      const p = payload as PoalimIlsPayload;
      return [String(p.retrievalTransactionData.accountNumber)];
    }
    case 'discount':
      return [];
    case 'isracard':
    case 'amex': {
      const p = payload as IsracardPayload;
      return p.CardsTransactionsListBean.Index0.CurrentCardTransactions.map(
        c => c['@cardTransactions'] as string,
      ).filter(Boolean);
    }
    case 'cal': {
      const p = payload as CalPayload;
      return p.result.bankAccounts.map(a => a.bankAccountNum);
    }
    case 'max': {
      const p = payload as MaxPayload;
      const txns = p.result?.transactions ?? [];
      return [...new Set(txns.map(t => String(t.cardIndex)))];
    }
  }
}

export function checkAccounts(
  type: SourceType,
  payload: ValidatedPayload,
  known: AccountRecord[],
): CheckResult {
  const identifiers = extractIdentifiers(type, payload);
  const accepted: string[] = [];
  const ignored: string[] = [];
  const unknown: string[] = [];

  for (const id of identifiers) {
    const record = known.find(a => a.sourceType === type && a.accountNumber === id);
    if (!record) {
      unknown.push(id);
    } else if (record.status === 'ignored') {
      ignored.push(id);
    } else {
      accepted.push(id);
    }
  }

  return { accepted, ignored, unknown };
}
