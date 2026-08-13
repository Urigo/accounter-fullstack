import type {
  IGetSecuritiesByKeysResult,
  IGetSecurityExecutionsResult,
} from './__generated__/foreign-securities.types.js';

export type * from './__generated__/types.js';
export type * from './__generated__/foreign-securities.types.js';

/** A row of `accounter_schema.poalim_securities`, as selected by `getSecuritiesByKeys`. */
export type SecurityRow = IGetSecuritiesByKeysResult;

/**
 * A row of `accounter_schema.poalim_securities_transactions`, as selected by
 * `getSecurityExecutions` — the curated subset of the ~100 source columns.
 */
export type SecurityExecutionRow = IGetSecurityExecutionsResult;

export type ChargeSecurityProto = {
  /** Scoped to the charge so the client cache keeps a key's entries distinct per charge. */
  id: string;
  securityKey: string;
  details: SecurityRow | null;
  transactionIds: string[];
  /** Ingested executions matched to this charge's transactions — see the matcher helper. */
  executions: SecurityExecutionRow[];
};
