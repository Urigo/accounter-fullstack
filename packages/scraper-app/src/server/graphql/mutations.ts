import type { IsracardCardsTransactionsList } from '@accounter/modern-poalim-scraper';
import {
  IsracardTransactionInput,
  MutationUploadAmexTransactionsArgs,
  MutationUploadIsracardTransactionsArgs,
} from '../gql/index.js';
import type { CalPayload } from '../payload-schemas/cal.schema.js';
import type { CurrencyRatesPayload } from '../payload-schemas/currency-rates.schema.js';
import type { DiscountPayload } from '../payload-schemas/discount.schema.js';
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
// Field names match the GraphQL input types in graphql schema, which mirror
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

function transformIsracardAmexTransaction(
  t:
    | Exclude<
        IsracardCardsTransactionsList['CardsTransactionsListBean']['Index0']['CurrentCardTransactions'][0]['txnIsrael'],
        null | undefined
      >[0]
    | Exclude<
        IsracardCardsTransactionsList['CardsTransactionsListBean']['Index0']['CurrentCardTransactions'][0]['txnAbroad'],
        null | undefined
      >[0],
  card: string,
): IsracardTransactionInput {
  const inputTransaction: IsracardTransactionInput = {
    card,
    specificDate: t.specificDate,
    cardIndex: Number.parseInt(t.cardIndex, 10),
    dealsInbound: t.dealsInbound,
    supplierId: t.supplierId ? Number(t.supplierId) : null,
    supplierName: t.supplierName,
    dealSumType: t.dealSumType,
    paymentSumSign: t.paymentSumSign,
    purchaseDate: t.purchaseDate,
    fullPurchaseDate: t.fullPurchaseDate,
    moreInfo: t.moreInfo,
    horaatKeva: t.horaatKeva,
    voucherNumber: t.voucherNumber ? Number(t.voucherNumber) : null,
    voucherNumberRatz: t.voucherNumberRatz ? Number(t.voucherNumberRatz) : null,
    solek: t.solek,
    purchaseDateOutbound: t.purchaseDateOutbound,
    fullPurchaseDateOutbound: t.fullPurchaseDateOutbound,
    currencyId: t.currencyId,
    currentPaymentCurrency: t.currentPaymentCurrency,
    city: t.city,
    supplierNameOutbound: t.supplierNameOutbound,
    fullSupplierNameOutbound: t.fullSupplierNameOutbound,
    paymentDate: t.paymentDate,
    fullPaymentDate: t.fullPaymentDate,
    isShowDealsOutbound: t.isShowDealsOutbound,
    adendum: t.adendum,
    voucherNumberRatzOutbound: t.voucherNumberRatzOutbound
      ? Number(t.voucherNumberRatzOutbound)
      : null,
    isShowLinkForSupplierDetails: t.isShowLinkForSupplierDetails,
    dealSum: t.dealSum,
    paymentSum: t.paymentSum,
    fullSupplierNameHeb: t.fullSupplierNameHeb,
    dealSumOutbound: t.dealSumOutbound,
    paymentSumOutbound: t.paymentSumOutbound,
    isHoraatKeva: t.isHoraatKeva,
    stage: t.stage,
    returnCode: t.returnCode,
    message: t.message,
    returnMessage: t.returnMessage,
    displayProperties: t.displayProperties,
    tablePageNum: t.tablePageNum === '0' ? false : true,
    isError: t.isError,
    isCaptcha: t.isCaptcha,
    isButton: t.isButton,
    siteName: t.siteName,
    kodMatbeaMekori: t.kodMatbeaMekori ?? null,
    esbServicesCall: t.EsbServicesCall ?? null,
  };

  // remove known unstable keys from input transaction
  const optionalTransactionKeys = [
    'clientIpAddress',
    'bcKey',
    'chargingDate',
    'requestNumber',
    'accountErrorCode',
    'monthlyRefundCardIndex',
    'id',
    'EsbServicesCall', // renamed to esbServicesCall above, to coerce to camelCase
  ];

  for (const key of optionalTransactionKeys) {
    if (inputTransaction[key as keyof IsracardTransactionInput] !== undefined) {
      delete inputTransaction[key as keyof IsracardTransactionInput];
    }
  }

  return inputTransaction;
}

// Isracard / Amex: CardsTransactionsListBean → flatten to per-transaction rows.
// Each row gets `card` (the 4-digit card identifier from cardNumberList),
// matching the `card` column the legacy scraper writes.
function flattenIsracardAmexPayloads(
  payloads: IsracardCardsTransactionsList[],
): IsracardTransactionInput[] {
  return payloads.flatMap(p => {
    const cardNumbers = p.CardsTransactionsListBean.cardNumberList.map(c => c.match(/\d{4}/)?.[0]);
    return Object.keys(p.CardsTransactionsListBean)
      .filter(k => /^Index\d+$/.test(k))
      .flatMap(k => {
        const card = cardNumbers[Number(k.slice(5))]; // 'Index0' → 0 → cardNumbers[0]
        if (!card) {
          throw new Error(`Missing card number for ${k} in Isracard payload`);
        }
        const idx = p.CardsTransactionsListBean[
          k
        ] as IsracardCardsTransactionsList['CardsTransactionsListBean']['Index0'];
        return idx.CurrentCardTransactions.flatMap(cardGroup => {
          const israelTxns = (cardGroup.txnIsrael ?? []).map(t =>
            transformIsracardAmexTransaction(t, card),
          );
          const abroadTxns = (cardGroup.txnAbroad ?? []).map(t =>
            transformIsracardAmexTransaction(t, card),
          );
          return [...israelTxns, ...abroadTxns];
        });
      });
  });
}

export function isracardVars(
  payloads: IsracardCardsTransactionsList[],
): MutationUploadIsracardTransactionsArgs {
  return { transactions: flattenIsracardAmexPayloads(payloads) };
}

export function amexVars(
  payloads: IsracardCardsTransactionsList[],
): MutationUploadAmexTransactionsArgs {
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
