import type { YogaInitialContext } from 'graphql-yoga';
import pg from 'pg';
import type { CorporateTaxRulingComplianceReport } from '../../__generated__/types.js';
import type { env } from '../../environment.js';
import type { IGetChargesByIdsResult } from '../../modules/charges/types.js';
import type { RawAuth } from '../../plugins/auth-plugin.js';
import type { Currency } from '../../shared/enums.js';

export type Environment = typeof env;

export type CurrencySum = {
  credit: number;
  debit: number;
  total: number;
};

export type RawBusinessTransactionsSum = Record<Currency, CurrencySum> & {
  businessId: string;
  /** Ledger fingerprint tuples collected from the records behind this sum */
  fingerprintTuples: string[];
};

export type VatExtendedCharge = IGetChargesByIdsResult & {
  vatAfterDeduction: number;
  amountBeforeVAT: number;
  amountBeforeFullVAT: number;
};

export type CorporateTaxRulingComplianceReportProto = Omit<
  CorporateTaxRulingComplianceReport,
  'differences'
> & {
  chargeIds: Set<string>;
};

export interface DocumentSuggestionsProto {
  ownerId?: string;
  counterpartyId?: string;
  amount?: {
    amount: number;
    currency: Currency;
  };
  isIncome?: boolean;
}

export type BusinessTransactionProto = {
  amount: number;
  businessId: string;
  counterAccountId?: string;
  currency: Currency;
  details?: string;
  isCredit: boolean;
  ownerID: string;
  foreignAmount: number;
  date: TimelessDateString;
  reference?: string;
  chargeId: string;
};

/**
 * A request-scoped DB client the cleanup plugin is responsible for releasing.
 *
 * `disposeWhenIdle` exists for the abort path: the caller hanging up does not
 * stop the operation already running on this server, so a client that is still
 * serving one is asked to release itself when it can, rather than being pulled
 * out from under a half-written mutation. Optional so a plain `{ dispose }` (as
 * used in tests and ad-hoc registrations) still satisfies the contract.
 *
 * It resolves to `true` when disposal was *deferred* — the client is still live
 * and must stay registered for the end-of-execution pass — and `false` when it
 * disposed on the spot.
 */
export type DisposableDbClient = {
  dispose: () => Promise<void>;
  disposeWhenIdle?: () => Promise<boolean>;
};

export type AccounterContext = YogaInitialContext & {
  env: Environment;
  pool: pg.Pool;
  rawAuth?: RawAuth;
  dbClientsToDispose?: DisposableDbClient[];
  /**
   * True while GraphQL execution for this request is running. Read by
   * TenantAwareDBClient (and its watchdog) to tell a request that is merely
   * quiet on the database — fetching a file, waiting on OCR — from one that has
   * gone away.
   */
  executionInFlight?: boolean;
};

/**
 * A calendar day, `yyyy-mm-dd`, with no time of day and no timezone (#4560).
 *
 * Postgres `date` columns (see `pgTypeParsers` and pgtyped's `typesOverrides`) and the GraphQL
 * `TimelessDate` scalar carry this type end to end; the scalar validates the exact format at the
 * API boundary.
 *
 * A pattern rather than a union of every valid day: a union of that size (tens of thousands of
 * literals) makes type-checking every expression that touches a date dramatically slower, and
 * would cap the years it can hold.
 */
export declare type TimelessDateString = `${number}-${number}-${number}`;

export type * from './ledger.js';
export type * from './utils.js';
