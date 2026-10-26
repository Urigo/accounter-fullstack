import type { Currency } from '../../shared/enums.js';
import type { TimelessDateString } from '../../shared/types/index.js';
import type {
  IGetSecuritiesByKeysResult,
  IGetSecurityExecutionsResult,
} from './__generated__/foreign-securities.types.js';
import type {
  IGetAllSecurityBusinessesResult,
  IGetSecurityIdentifiersByBusinessIdsResult,
  security_identifier_type,
} from './__generated__/security-businesses.types.js';
import type { SecurityAccountProto } from './helpers/security-account.helper.js';
import type { SecurityPositionProto } from './helpers/security-position.helper.js';

export type { SecurityAccountProto } from './helpers/security-account.helper.js';

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
  IUpdateSecurityBusinessesIsForeignQuery,
} from './__generated__/security-businesses.types.js';

// Named rather than `export type *`: the generated module declares `stringArray` too.
export type {
  IGetChargeIdsByExecutionIdsQuery,
  IGetExecutionIdsByChargeIdsQuery,
  IGetUnlinkedDistributionsQuery,
  IInsertChargeSecurityExecutionQuery,
  IReplaceChargeSecurityExecutionsChargeIdQuery,
} from './__generated__/security-execution-charges.types.js';

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
  /** As the source spells it — Hebrew label or ISO code; the provider normalizes it. */
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

/** The derived position, carrying the security it belongs to so clients can cache it. */
export type SecurityPositionWithIdProto = SecurityPositionProto & { id: string };

/** An execution paired with the cash movement behind it, for a security's own page. */
export type SecurityHistoryExecutionProto = {
  id: string;
  execution: SecurityExecutionRow;
  /**
   * The security business the execution belongs to. Carried rather than resolved from the row
   * because the executions table is keyed by Poalim's security key, and several keys can
   * collapse onto one ISIN — the caller already knows which business it asked for.
   */
  securityBusinessId: string;
  /** The matched transaction, carrying the charge it belongs to. Null when nothing matched. */
  transaction: { id: string; charge_id: string } | null;
};

/** A page of executions plus the total the filter matched, for `Query.securityExecutions`. */
export type PaginatedSecurityExecutionsProto = {
  nodes: SecurityHistoryExecutionProto[];
  totalRecords: number;
  currentPage: number;
  pageSize: number;
};

/** What `Query.securityExecutions` narrows on, normalized off the GraphQL input. */
export type SecurityExecutionsFilterInput = {
  securityBusinessIds?: readonly string[] | null;
  isins?: readonly string[] | null;
  symbols?: readonly string[] | null;
  fromTradeDate?: TimelessDateString | null;
  toTradeDate?: TimelessDateString | null;
  /** The bank's own labels, already translated from the GraphQL enums by the resolver. */
  rawTradeTypes?: readonly string[] | null;
  rawTransactionTypes?: readonly string[] | null;
};

/** What one portfolio account holds of a security */
export type SecurityAccountHoldingProto = {
  /** The security's business id and the account's id */
  id: string;
  account: SecurityAccountProto;
  position: SecurityPositionWithIdProto;
};

/**
 * One security plus the position its executions imply, for the tenant-wide holdings list.
 * The execution list itself is deliberately absent — see the `SecurityHolding` type.
 */
export type SecurityHoldingProto = {
  id: string;
  security: SecurityBusinessRow;
  position: SecurityPositionWithIdProto;
  accounts: SecurityAccountHoldingProto[];
};

export type SecurityBusinessHistoryProto = {
  id: string;
  security: SecurityBusinessRow;
  position: SecurityPositionWithIdProto;
  accounts: SecurityAccountHoldingProto[];
  executions: SecurityHistoryExecutionProto[];
};

export type ChargeSecurityProto = {
  /** Scoped to the charge so the client cache keeps a key's entries distinct per charge. */
  id: string;
  /** The charge this security was found in */
  chargeId: string;
  /**
   * The charge's owner. Carried because the Poalim key is only unique within one — resolving the
   * key to a security without it can attach a charge to another business's security.
   */
  ownerId: string;
  securityKey: string;
  details: SecurityRow | null;
  transactionIds: string[];
  /** Ingested executions matched to this charge's transactions — see the matcher helper. */
  executions: SecurityExecutionRow[];
};

/**
 * The units of a disposal drawn from one acquisition, first in, first out: what they cost and
 * fetched, and their capital gain under s.88 of the Income Tax Ordinance with the CPI as index.
 * Local amounts are at the representative rates of the trade dates.
 */
export type SecurityCapitalGainLotProto = {
  /** The disposal, the purchase and the lot's place among the disposal's lots */
  id: string;
  purchaseExecutionId: string;
  purchaseDate: TimelessDateString;
  quantity: number;
  currency: Currency;
  localCurrency: Currency;
  /** In `currency` */
  cost: number;
  costLocal: number;
  purchaseRate: number;
  /** The lot's share of the proceeds, in the local currency */
  consideration: number;
  /** The month of the CPI known on the purchase date, YYYY-MM */
  purchaseIndexPeriod: string;
  /** The month of the CPI known on the sale date, YYYY-MM */
  saleIndexPeriod: string;
  indexRatio: number;
  nominalGain: number;
  inflationaryAmount: number;
  realGain: number;
};

/** A sale's or a redemption's capital gain, from the FIFO lots it disposes of */
export type SecurityCapitalGainProto = {
  /** The disposal's execution id */
  id: string;
  currency: Currency;
  localCurrency: Currency;
  quantity: number;
  /** What the units fetched before tax, in `currency` */
  proceeds: number;
  saleRate: number;
  /** What the units cost, in `currency` */
  cost: number;
  originCurrencyGain: number;
  nominalGain: number;
  priceGain: number;
  exchangeRateGain: number;
  inflationaryAmount: number;
  realGain: number;
  lots: SecurityCapitalGainLotProto[];
};
