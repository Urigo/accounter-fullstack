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
  date: Date;
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

type addZero<T> = T | 0;
type oneToFour = 1 | 2 | 3 | 4;
type oneToNine = oneToFour | 5 | 6 | 7 | 8 | 9;
type d = addZero<oneToNine>;
type YYYY = `20${addZero<oneToFour>}${d}`;
type MM = `0${oneToNine}` | `1${0 | 1 | 2}`;
type DD = `${0}${oneToNine}` | `${1 | 2}${d}` | `3${0 | 1}`;

export declare type TimelessDateString = `${YYYY}-${MM}-${DD}`;

export type * from './ledger.js';
export type * from './utils.js';
