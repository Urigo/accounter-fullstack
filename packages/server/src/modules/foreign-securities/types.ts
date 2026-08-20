import type {
  IGetSecuritiesByKeysResult,
  IGetSecurityExecutionsResult,
} from './__generated__/foreign-securities.types.js';
import type {
  IGetAllSecurityBusinessesResult,
  IGetSecurityIdentifiersByBusinessIdsResult,
  security_identifier_type,
} from './__generated__/security-businesses.types.js';

export type * from './__generated__/types.js';
export type * from './__generated__/foreign-securities.types.js';
// Named rather than `export type *`: both generated modules declare `stringArray`.
export type {
  IGetSecurityBusinessesByIdentifiersQuery,
  IGetSecurityBusinessesByIdsQuery,
  IGetSecurityBusinessesByIsinsQuery,
  IGetSecurityIdentifiersByBusinessIdsQuery,
  IInsertSecurityBusinessQuery,
  IInsertSecurityIdentifierQuery,
  IGetAllSecurityBusinessesQuery,
} from './__generated__/security-businesses.types.js';

/** How a source names a security — accounter_schema.security_identifier_type. */
export type SecurityIdentifierType = security_identifier_type;

/** A row of `accounter_schema.businesses_securities` — the security side of a business. */
export type SecurityBusinessRow = IGetAllSecurityBusinessesResult;

/** A row of `accounter_schema.security_identifiers`. */
export type SecurityIdentifierRow = IGetSecurityIdentifiersByBusinessIdsResult;

/**
 * What a security business is created from. Everything but the ISIN is a display descriptor,
 * copied off the ingested row that first introduced the security.
 */
export type SecurityBusinessDescriptors = {
  isin: string;
  symbol?: string | null;
  engName?: string | null;
  hebName?: string | null;
  exchange?: string | null;
  currencyCode?: string | null;
  itemType?: string | null;
  stockType?: string | null;
  isEtf?: boolean | null;
  isForeign?: boolean | null;
  issuerCountryCode?: string | null;
};

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
