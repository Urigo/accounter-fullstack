import { vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import { Currency } from '../../../../../../shared/enums.js';
import type {
  LedgerRecordsProto,
  TimelessDateString,
} from '../../../../../../shared/types/index.js';
import type { IGetTransactionsByChargeIdsResult } from '../../../../../transactions/types.js';
import type { IGetLedgerRecordsByChargesIdsResult } from '../../../../types.js';

/*
 * In-memory building blocks for ledger-generation resolver tests: no database, only mock data.
 */

export const EXCHANGE_LEDGER_RECORD = 'Exchange ledger record';

/**
 * A point in time as `pg` parses a `timestamp` (without time zone) column: the wall-clock time in
 * the server's zone. Call it inside a test, so it is built under the timezone being tested.
 */
export function at(day: TimelessDateString, hours: number, minutes: number, seconds = 0): Date {
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  return new Date(year, month - 1, dayOfMonth, hours, minutes, seconds);
}

export type TransactionInput = {
  id: string;
  chargeId: string;
  ownerId: string;
  accountId: string;
  businessId: string;
  amount: string;
  currency: Currency;
  debitDate: TimelessDateString;
  /** Set for crypto rows only, as the scrapers do */
  debitTimestamp?: Date;
  isFee?: boolean;
  description?: string;
};

export function buildTransaction(input: TransactionInput): IGetTransactionsByChargeIdsResult {
  return {
    id: input.id,
    account_id: input.accountId,
    amount: input.amount,
    business_id: input.businessId,
    charge_id: input.chargeId,
    counter_account: null,
    created_at: new Date('2025-03-14T00:00:00.000Z'),
    currency: input.currency,
    currency_rate: '0',
    current_balance: '0',
    debit_date: input.debitDate,
    debit_date_override: null,
    debit_timestamp: input.debitTimestamp ?? null,
    event_date: input.debitDate,
    is_fee: input.isFee ?? false,
    origin_key: `origin-${input.id}`,
    owner_id: input.ownerId,
    source_description: input.description ?? null,
    source_id: `source-${input.id}`,
    source_origin: 'MOCK',
    source_reference: `reference-${input.id}`,
    updated_at: new Date('2025-03-14T00:00:00.000Z'),
  };
}

/** [currency, the day or exact time a rate is quoted for, local currency (ILS) per unit] */
export type MockRate = [Currency, TimelessDateString | Date, number];

function rateKey(currency: Currency, date: TimelessDateString | Date): string {
  return `${currency}@${typeof date === 'string' ? date : date.toISOString()}`;
}

/**
 * An `ExchangeProvider` stub that only quotes ILS rates at the exact points listed: a lookup at any
 * other day or time fails the test. That keeps crypto rows priced at their exact time.
 */
export function makeExchangeProvider(rates: MockRate[]) {
  const table = new Map(rates.map(([currency, date, rate]) => [rateKey(currency, date), rate]));
  return {
    getExchangeRates: vi.fn(
      async (baseCurrency: Currency, quoteCurrency: Currency, date: TimelessDateString | Date) => {
        if (baseCurrency === quoteCurrency) {
          return 1;
        }
        const rate = table.get(rateKey(baseCurrency, date));
        if (rate === undefined || quoteCurrency !== Currency.Ils) {
          throw new Error(`No mock rate for ${rateKey(baseCurrency, date)} in ${quoteCurrency}`);
        }
        return rate;
      },
    ),
  };
}

/** An injector serving the given provider stubs, which fails on any provider it wasn't given */
export function makeInjector(providers: Map<unknown, unknown>): Injector {
  return {
    get: (token: unknown) => {
      if (!providers.has(token)) {
        throw new Error(`Unexpected provider token: ${String(token)}`);
      }
      return providers.get(token);
    },
  } as unknown as Injector;
}

/** A `FinancialEntitiesProvider` stub: `businessIds` are businesses, everything else a tax category */
export function makeFinancialEntitiesProvider(businessIds: string[] = []) {
  return {
    getFinancialEntityByIdLoader: {
      loadMany: async (ids: string[]) =>
        ids.map(id => ({
          id,
          name: id,
          type: businessIds.includes(id) ? 'business' : 'tax_category',
        })),
    },
  };
}

/** Narrows a ledger-generation resolver result to its generated records */
export function expectGeneratedRecords(
  result: LedgerRecordsProto | { message: string } | null | undefined,
): LedgerRecordsProto {
  if (!result || !('records' in result)) {
    throw new Error(
      `Expected generated ledger records, got: ${result ? result.message : String(result)}`,
    );
  }
  return result;
}

function round(value: string | null | undefined): number | null {
  return value == null ? null : Math.round(Number(value) * 1e6) / 1e6;
}

/** The parts of a record these tests care about, with amounts rounded off float noise */
export function summarize(record: IGetLedgerRecordsByChargesIdsResult) {
  return {
    debit: record.debit_entity1,
    credit: record.credit_entity1,
    currency: record.currency,
    foreignAmount: round(record.debit_foreign_amount1 ?? record.credit_foreign_amount1),
    localAmount: round(record.debit_local_amount1 ?? record.credit_local_amount1),
    invoiceDate: record.invoice_date,
    valueDate: record.value_date,
    description: record.description,
  };
}

export function exchangeRecords(records: IGetLedgerRecordsByChargesIdsResult[]) {
  return records.filter(record => record.description === EXCHANGE_LEDGER_RECORD);
}
