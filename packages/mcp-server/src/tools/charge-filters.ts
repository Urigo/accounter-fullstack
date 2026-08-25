import { z } from 'zod';
import { TIMELESS_DATE } from './dates.js';

/**
 * The single definition of the upstream `ChargeFilter` input, shared by every
 * charge tool.
 *
 * Both charge tools (`accounter_search_charges` and `accounter_get_charges`)
 * filter the same upstream `allCharges` field, so they must accept the same
 * predicates. Keeping the zod shape and the filter builder here — rather than a
 * copy per tool — is what makes "the tool exposes every `ChargeFilter` field"
 * checkable in one place (see `schema-contract.test.ts`) instead of drifting the
 * moment a field is added upstream.
 *
 * `search_charges` spreads {@link CHARGE_FILTER_SHAPE} at the top level (minus
 * the fields it exposes under friendlier names) while `get_charges` nests it
 * under `filters`; both hand the result to {@link buildChargeFilters}.
 */

/**
 * `ChargeFilter` fields deliberately **not** exposed, because upstream accepts
 * them and then ignores them.
 *
 * `allCharges` forwards its filter to `ChargesProvider.getChargesByFilters`, and
 * these two are never passed on — there is no SQL predicate behind them at
 * all (the client's charges screen sends `unbalanced` and it does nothing
 * either). A filter that silently matches everything is worse than an absent
 * one for a model: it asks for "only unbalanced charges", gets the whole table,
 * and has no way to tell. They stay out until upstream implements them; the
 * schema-contract test uses this list, so it fails loudly if the set of
 * unimplemented fields changes.
 */
export const UNSUPPORTED_UPSTREAM_CHARGE_FILTER_FIELDS = ['businessTrip', 'unbalanced'] as const;

export const CHARGE_FILTER_IDS_CAP = 300;
export const CHARGE_FILTER_TAGS_CAP = 50;
export const CHARGE_FILTER_TEXT_MAX = 200;

/** Every `ChargeType` in the schema — the vocabulary of `byChargeTypes`. */
export const CHARGE_TYPES = [
  'COMMON',
  'CONVERSION',
  'PAYROLL',
  'INTERNAL',
  'DIVIDEND',
  'BUSINESS_TRIP',
  'VAT',
  'BANK_DEPOSIT',
  'FOREIGN_SECURITIES',
  'CREDITCARD_BANK',
  'FINANCIAL',
] as const;

/** Every `AccountantStatus` in the schema. */
export const ACCOUNTANT_STATUSES = ['APPROVED', 'PENDING', 'UNAPPROVED'] as const;

/** Every `ChargeSortByField` in the schema. */
export const CHARGE_SORT_FIELDS = ['DATE', 'AMOUNT', 'ABS_AMOUNT'] as const;

/**
 * An optional array of non-empty strings that treats `[]` as "not supplied".
 *
 * An empty array reaching upstream would be a filter matching nothing, which is
 * never what a caller means by omitting a predicate.
 */
export function optionalNonEmptyStringArray(max: number) {
  return z.preprocess(
    value => (Array.isArray(value) && value.length === 0 ? undefined : value),
    z.array(z.string().min(1)).min(1).max(max).optional(),
  );
}

/** Same empty-array-means-absent treatment, for a fixed enum vocabulary. */
function optionalNonEmptyEnumArray<const T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(
    value => (Array.isArray(value) && value.length === 0 ? undefined : value),
    z.array(z.enum(values)).min(1).max(values.length).optional(),
  );
}

export const chargeSortByInput = z
  .object({
    field: z
      .enum(CHARGE_SORT_FIELDS)
      .describe('Sort key: DATE, AMOUNT, or ABS_AMOUNT (amount ignoring sign).'),
    asc: z
      .boolean()
      .optional()
      .describe('Ascending when true. Omit for the tool default (newest/largest first).'),
  })
  .strict();

/**
 * One zod field per upstream `ChargeFilter` field, keyed by the *upstream* name.
 *
 * Keys must stay identical to the schema field names: {@link buildChargeFilters}
 * copies them straight across, and the schema-contract test compares this key
 * set against `input ChargeFilter` in `schema.graphql`.
 */
export const CHARGE_FILTER_SHAPE = {
  accountantStatus: optionalNonEmptyEnumArray(ACCOUNTANT_STATUSES)
    .optional()
    .describe('Include only charges in these accountant-review states.'),
  byBusinessTrips: optionalNonEmptyStringArray(CHARGE_FILTER_IDS_CAP)
    .optional()
    .describe('Include only charges tied to one of these business-trip ids.'),
  byBusinesses: optionalNonEmptyStringArray(CHARGE_FILTER_IDS_CAP)
    .optional()
    .describe(
      'Include only charges involving these businesses as the *counterparty* (the other party). ' +
        'This is not the owner predicate — narrow owners with `memberBusinessIds` / `byOwners`.',
    ),
  byFinancialAccounts: optionalNonEmptyStringArray(CHARGE_FILTER_IDS_CAP)
    .optional()
    .describe(
      'Include only charges with at least one transaction in these financial accounts (bank ' +
        'account / credit card ids).',
    ),
  byChargeTypes: optionalNonEmptyEnumArray(CHARGE_TYPES)
    .optional()
    .describe(
      'Include only charges of these types (same vocabulary as the `chargeType` field on each row), ' +
        'e.g. exclude INTERNAL/CONVERSION to drop money moving between your own accounts.',
    ),
  byOwners: optionalNonEmptyStringArray(CHARGE_FILTER_IDS_CAP)
    .optional()
    .describe(
      'Include only charges owned by these business ids. Always intersected with your authorized ' +
        'read scope, so it can only narrow, never widen.',
    ),
  byTags: optionalNonEmptyStringArray(CHARGE_FILTER_TAGS_CAP)
    .optional()
    .describe('Include only charges carrying these tags.'),
  chargesType: z
    .enum(['ALL', 'INCOME', 'EXPENSE'])
    .optional()
    .describe('Restrict to income or expense charges (ALL for both).'),
  freeText: z
    .string()
    .min(2)
    .max(CHARGE_FILTER_TEXT_MAX)
    .optional()
    .describe(
      'Free-text search across the charge: user description, transaction description/reference, and ' +
        'document description/remarks/serial.',
    ),
  fromAnyDate: TIMELESS_DATE.optional().describe(
    'Overlap filter: include charges with *any* document/transaction/ledger date on or after this ' +
      'date. Broader than `fromDate` — "active in this period".',
  ),
  fromDate: TIMELESS_DATE.optional().describe(
    'Containment filter on the charge’s main date (documents min date, else transactions min event ' +
      'date): on or after this date.',
  ),
  sortBy: chargeSortByInput.optional().describe('Result ordering.'),
  toAnyDate: TIMELESS_DATE.optional().describe(
    'Overlap filter: include charges with *any* document/transaction/ledger date on or before this date.',
  ),
  toDate: TIMELESS_DATE.optional().describe(
    'Containment filter on the charge’s main date: on or before this date.',
  ),
  withMissingCounterparty: z
    .boolean()
    .optional()
    .describe(
      'Include only charges missing a counterparty — a transaction without a business, or a document ' +
        'without a creditor/debtor.',
    ),
  withOpenDocuments: z
    .boolean()
    .optional()
    .describe('Include only charges with open (unpaid/unmatched) documents.'),
  withoutDocuments: z
    .boolean()
    .optional()
    .describe('Include only charges with no linked documents.'),
  withoutInvoice: z
    .boolean()
    .optional()
    .describe('Include only charges with no linked invoice document.'),
  withoutLedger: z
    .boolean()
    .optional()
    .describe('Include only charges with no linked ledger records.'),
  withoutReceipt: z
    .boolean()
    .optional()
    .describe('Include only charges with no linked receipt document.'),
  withoutTransactions: z
    .boolean()
    .optional()
    .describe('Include only charges with no linked transactions.'),
} as const;

/** Upstream `ChargeFilter` field names, derived from the one shape above. */
export const CHARGE_FILTER_FIELDS = Object.keys(CHARGE_FILTER_SHAPE) as ReadonlyArray<
  keyof typeof CHARGE_FILTER_SHAPE
>;

export const chargeFiltersInput = z.object(CHARGE_FILTER_SHAPE).strict();

export type ChargeFiltersInput = z.infer<typeof chargeFiltersInput>;

/** Whether any predicate was actually supplied (all fields are optional). */
export function hasAnyChargeFilter(filters: Partial<ChargeFiltersInput> | undefined): boolean {
  return filters !== undefined && Object.values(filters).some(value => value !== undefined);
}

/**
 * Intersect a requested owner list with the authorized read scope. An absent or
 * empty request means "the whole scope"; a request can only ever narrow it.
 */
export function intersectOwners(
  requested: readonly string[] | undefined,
  scopeBusinessIds: readonly string[],
): string[] {
  const scopeSet = new Set(scopeBusinessIds);
  if (!requested || requested.length === 0) {
    return [...scopeBusinessIds];
  }
  return requested.filter(id => scopeSet.has(id));
}

/** Filter values as they are sent upstream — the `ChargeFilter` input object. */
export type UpstreamChargeFilter = {
  -readonly [K in keyof ChargeFiltersInput]: ChargeFiltersInput[K];
};

/**
 * Build the upstream `ChargeFilter` from validated tool input.
 *
 * `byOwners` is always set (scope-intersected) so a business-scoped tool can
 * never reach upstream without an owner predicate. Every other field is copied only when
 * supplied: an absent bound must stay absent rather than become an explicit
 * `null`, which upstream would read differently from "unbounded".
 */
export function buildChargeFilters(
  input: Partial<ChargeFiltersInput>,
  scopeBusinessIds: readonly string[],
): UpstreamChargeFilter {
  const filters: UpstreamChargeFilter = {
    byOwners: intersectOwners(input.byOwners, scopeBusinessIds),
  };
  if (input.accountantStatus) filters.accountantStatus = [...input.accountantStatus];
  if (input.byBusinessTrips) filters.byBusinessTrips = [...input.byBusinessTrips];
  if (input.byBusinesses) filters.byBusinesses = [...input.byBusinesses];
  if (input.byFinancialAccounts) filters.byFinancialAccounts = [...input.byFinancialAccounts];
  if (input.byChargeTypes) filters.byChargeTypes = [...input.byChargeTypes];
  if (input.byTags) filters.byTags = [...input.byTags];
  if (input.chargesType) filters.chargesType = input.chargesType;
  if (input.freeText) filters.freeText = input.freeText;
  if (input.fromAnyDate) filters.fromAnyDate = input.fromAnyDate;
  if (input.fromDate) filters.fromDate = input.fromDate;
  if (input.sortBy) filters.sortBy = { ...input.sortBy };
  if (input.toAnyDate) filters.toAnyDate = input.toAnyDate;
  if (input.toDate) filters.toDate = input.toDate;
  if (input.withMissingCounterparty !== undefined) {
    filters.withMissingCounterparty = input.withMissingCounterparty;
  }
  if (input.withOpenDocuments !== undefined) filters.withOpenDocuments = input.withOpenDocuments;
  if (input.withoutDocuments !== undefined) filters.withoutDocuments = input.withoutDocuments;
  if (input.withoutInvoice !== undefined) filters.withoutInvoice = input.withoutInvoice;
  if (input.withoutLedger !== undefined) filters.withoutLedger = input.withoutLedger;
  if (input.withoutReceipt !== undefined) filters.withoutReceipt = input.withoutReceipt;
  if (input.withoutTransactions !== undefined) {
    filters.withoutTransactions = input.withoutTransactions;
  }
  return filters;
}
