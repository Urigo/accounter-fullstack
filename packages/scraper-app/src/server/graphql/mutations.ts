import type { AmexPayload } from '../payload-schemas/amex.schema.js';
import type { CalPayload } from '../payload-schemas/cal.schema.js';
import type { CurrencyRatesPayload } from '../payload-schemas/currency-rates.schema.js';
import type { DiscountPayload } from '../payload-schemas/discount.schema.js';
import type { IsracardPayload } from '../payload-schemas/isracard.schema.js';
import type { MaxPayload } from '../payload-schemas/max.schema.js';
import type { PoalimForeignPayload } from '../payload-schemas/poalim-foreign.schema.js';
import type { PoalimIlsPayload } from '../payload-schemas/poalim-ils.schema.js';
import type { PoalimSwiftPayload } from '../payload-schemas/poalim-swift.schema.js';

// ── Mutation document strings ──────────────────────────────────────────────────

export const UPLOAD_POALIM_ILS = /* GraphQL */ `
  mutation UploadPoalimIlsTransactions($transactions: [PoalimIlsTransactionInput!]!) {
    uploadPoalimIlsTransactions(transactions: $transactions) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

export const UPLOAD_POALIM_FOREIGN = /* GraphQL */ `
  mutation UploadPoalimForeignTransactions($transactions: [PoalimForeignTransactionInput!]!) {
    uploadPoalimForeignTransactions(transactions: $transactions) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

export const UPLOAD_POALIM_SWIFT = /* GraphQL */ `
  mutation UploadPoalimSwiftTransactions($swifts: [PoalimSwiftTransactionInput!]!) {
    uploadPoalimSwiftTransactions(swifts: $swifts) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

export const UPLOAD_ISRACARD = /* GraphQL */ `
  mutation UploadIsracardTransactions($transactions: [IsracardTransactionInput!]!) {
    uploadIsracardTransactions(transactions: $transactions) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

export const UPLOAD_AMEX = /* GraphQL */ `
  mutation UploadAmexTransactions($transactions: [AmexTransactionInput!]!) {
    uploadAmexTransactions(transactions: $transactions) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

export const UPLOAD_CAL = /* GraphQL */ `
  mutation UploadCalTransactions($transactions: [CalTransactionInput!]!) {
    uploadCalTransactions(transactions: $transactions) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

export const UPLOAD_DISCOUNT = /* GraphQL */ `
  mutation UploadDiscountTransactions($transactions: [DiscountTransactionInput!]!) {
    uploadDiscountTransactions(transactions: $transactions) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

export const UPLOAD_MAX = /* GraphQL */ `
  mutation UploadMaxTransactions($transactions: [MaxTransactionInput!]!) {
    uploadMaxTransactions(transactions: $transactions) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

export const UPLOAD_CURRENCY_RATES = /* GraphQL */ `
  mutation UploadCurrencyRates($rates: [CurrencyRateInput!]!) {
    uploadCurrencyRates(rates: $rates) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

// ── Variable builders ─────────────────────────────────────────────────────────
// Each function maps a typed payload to the mutation variables object.
// Field names match the GraphQL input types in stub-schema.graphql, which mirror
// the pgtyped INSERT param shapes from the legacy scraper.

export function poalimIlsVars(payload: PoalimIlsPayload) {
  // accountNumber / branchNumber / bankNumber are embedded in each transaction row
  // via retrievalTransactionData — spread onto every transaction so the server can
  // partition by account without a separate top-level arg.
  const { accountNumber, branchNumber, bankNumber } = payload.retrievalTransactionData;
  const transactions = payload.transactions.map(t => ({
    ...t,
    accountNumber,
    branchNumber,
    bankNumber,
    // Coerce numeric values to String to match GraphQL scalar (server parses back)
    referenceNumber: t.referenceNumber == null ? null : String(t.referenceNumber),
    eventAmount: t.eventAmount == null ? null : String(t.eventAmount),
    currentBalance: t.currentBalance == null ? null : String(t.currentBalance),
    eventDate: t.eventDate == null ? null : String(t.eventDate),
    expandedEventDate: t.expandedEventDate == null ? null : String(t.expandedEventDate),
    eventId: t.eventId == null ? null : String(t.eventId),
  }));
  return { transactions };
}

export function poalimForeignVars(payload: PoalimForeignPayload) {
  // The foreign payload groups transactions by currency under balancesAndLimitsDataList.
  // Flatten to one row per transaction, carrying currencySwiftCode and account coords.
  const transactions = payload.balancesAndLimitsDataList.flatMap(entry =>
    entry.transactions.map(t => ({
      ...t,
      currencySwiftCode: entry.currencySwiftCode,
      // Numeric fields coerced to String
      eventAmount: t.eventAmount == null ? null : String(t.eventAmount),
      currentBalance: t.currentBalance == null ? null : String(t.currentBalance),
      currencyRate: t.currencyRate == null ? null : String(t.currencyRate),
      referenceNumber: t.referenceNumber == null ? null : String(t.referenceNumber),
    })),
  );
  return { transactions };
}

export function poalimSwiftVars(payload: PoalimSwiftPayload) {
  const swifts = payload.swiftsList.map(s => ({
    ...s,
    startDate: s.startDate == null ? null : String(s.startDate),
    amount: s.amount == null ? null : String(s.amount),
  }));
  return { swifts };
}

// Isracard / Amex: CardsTransactionsListBean → flatten to per-transaction rows.
// Each row gets `card` (the 4-digit card identifier from @cardTransactions),
// matching the `card` column the legacy scraper writes.
function flattenIsracardAmexPayloads(payloads: IsracardPayload[]): Record<string, unknown>[] {
  return payloads.flatMap(p =>
    Object.keys(p.CardsTransactionsListBean)
      .filter(k => /^Index\d+$/.test(k))
      .flatMap(k => {
        const idx = p.CardsTransactionsListBean[k] as {
          CurrentCardTransactions: Array<{
            '@cardTransactions': string;
            txnIsrael?: Array<Record<string, unknown>> | null;
            txnAbroad?: Array<Record<string, unknown>> | null;
          }>;
        };
        return idx.CurrentCardTransactions.flatMap(cardGroup => {
          const card = cardGroup['@cardTransactions'];
          const israelTxns = (cardGroup.txnIsrael ?? []).map(t => ({ ...t, card }));
          const abroadTxns = (cardGroup.txnAbroad ?? []).map(t => ({ ...t, card }));
          return [...israelTxns, ...abroadTxns];
        });
      }),
  );
}

export function isracardVars(payloads: IsracardPayload[]) {
  return { transactions: flattenIsracardAmexPayloads(payloads) };
}

export function amexVars(payloads: AmexPayload[]) {
  return { transactions: flattenIsracardAmexPayloads(payloads) };
}

export function calVars(payload: CalPayload) {
  // CalPayload is { card, month, transactions[] }[] — flatten to per-transaction rows.
  // Each row gets `card` from the outer entry so the server knows which card it belongs to.
  const transactions = payload.flatMap(entry =>
    entry.transactions.map(t => ({
      ...t,
      card: entry.card,
      // Coerce numeric string fields
      trnAmt: t.trnAmt == null ? null : String(t.trnAmt),
      amtBeforeConvAndIndex:
        t.amtBeforeConvAndIndex == null ? null : String(t.amtBeforeConvAndIndex),
      cashAccountTrnAmt: t.cashAccountTrnAmt == null ? null : String(t.cashAccountTrnAmt),
    })),
  );
  return { transactions };
}

export function discountVars(payload: DiscountPayload) {
  // DiscountPayload is { accountNumber, month, balance, transactions[] }[] — flatten.
  // The scraper returns PascalCase field names (OperationDate, etc.); map to camelCase
  // to match the GraphQL input type and DB column conventions.
  const transactions = payload.flatMap(entry =>
    entry.transactions.map(t => {
      const raw = t as Record<string, unknown>;
      return {
        accountNumber: entry.accountNumber,
        operationDate: raw['OperationDate'] ?? null,
        valueDate: raw['ValueDate'] ?? null,
        operationCode: raw['OperationCode'] ?? null,
        operationDescription: raw['OperationDescription'] ?? null,
        operationDescription2: raw['OperationDescription2'] ?? null,
        operationDescription3: raw['OperationDescription3'] ?? null,
        operationBranch: raw['OperationBranch'] ?? null,
        operationBank: raw['OperationBank'] ?? null,
        channel: raw['Channel'] ?? null,
        channelName: raw['ChannelName'] ?? null,
        checkNumber: raw['CheckNumber'] ?? null,
        instituteCode: raw['InstituteCode'] ?? null,
        operationAmount: raw['OperationAmount'] == null ? null : String(raw['OperationAmount']),
        balanceAfterOperation:
          raw['BalanceAfterOperation'] == null ? null : String(raw['BalanceAfterOperation']),
        operationNumber: raw['OperationNumber'] ?? null,
        branchTreasuryNumber: raw['BranchTreasuryNumber'] ?? null,
        urn: raw['Urn'] ?? null,
        operationDetailsServiceName: raw['OperationDetailsServiceName'] ?? null,
        commissionChannelCode: raw['CommissionChannelCode'] ?? null,
        commissionChannelName: raw['CommissionChannelName'] ?? null,
        commissionTypeName: raw['CommissionTypeName'] ?? null,
        businessDayDate: raw['BusinessDayDate'] ?? null,
        eventName: raw['EventName'] ?? null,
        categoryCode: raw['CategoryCode'] ?? null,
        categoryDescCode: raw['CategoryDescCode'] ?? null,
        categoryDescription: raw['CategoryDescription'] ?? null,
        operationDescriptionToDisplay: raw['OperationDescriptionToDisplay'] ?? null,
        operationOrder: raw['OperationOrder'] ?? null,
        isLastSeen: raw['IsLastSeen'] ?? null,
      };
    }),
  );
  return { transactions };
}

export function maxVars(payload: MaxPayload) {
  // MaxPayload is { accountNumber, txns[] }[] — flatten to per-transaction rows.
  const transactions = payload.flatMap(entry =>
    entry.txns.map(t => ({
      ...t,
      // Coerce numeric string fields
      actualPaymentAmount: t.actualPaymentAmount == null ? null : String(t.actualPaymentAmount),
      dealDataAmount: t.dealDataAmount == null ? null : String(t.dealDataAmount),
      dealDataAmountIls: t.dealDataAmountIls == null ? null : String(t.dealDataAmountIls),
    })),
  );
  return { transactions };
}

export function currencyRatesVars(payload: CurrencyRatesPayload) {
  // CurrencyRatesPayload is { date, currency, rate }[] — one entry per currency per day.
  // The DB table has one row per date with one column per currency.
  // Pivot: group by date, set the matching currency column.
  const byDate = new Map<string, Record<string, number | undefined>>();
  for (const entry of payload) {
    const row = byDate.get(entry.date) ?? {};
    row[entry.currency.toLowerCase()] = entry.rate;
    byDate.set(entry.date, row);
  }
  const rates = Array.from(byDate.entries()).map(([exchangeDate, cols]) => ({
    exchangeDate,
    usd: cols['usd'],
    eur: cols['eur'],
    gbp: cols['gbp'],
    cad: cols['cad'],
    jpy: cols['jpy'],
    aud: cols['aud'],
    sek: cols['sek'],
  }));
  return { rates };
}
