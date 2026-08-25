import { z } from 'zod';
import {
  AccountantStatus,
  ChargeFilterType,
  ChargeSortByField,
  ChargeType,
  type ChargeFilter,
} from '../../../gql/graphql.js';
import type { TimelessDateString } from '../../../helpers/dates.js';
import { TIMELESS_DATE_REGEX } from '../../../helpers/index.js';

const timelessDate = z
  .string()
  .regex(TIMELESS_DATE_REGEX, 'Date must be in format yyyy-mm-dd')
  .optional();

const idList = z.array(z.string()).optional();

const searchText = z
  .string()
  .optional()
  .refine(
    value => !value || value.trim().length === 0 || value.trim().length >= 2,
    'Must be at least 2 characters',
  );

export const chargeFilterFormSchema = z
  .object({
    fromAnyDate: timelessDate,
    toAnyDate: timelessDate,

    byOwners: idList,
    byBusinesses: idList,
    excludedBusinesses: idList,
    byFinancialAccounts: idList,
    excludedFinancialAccounts: idList,
    byTags: idList,
    excludedTags: idList,
    byBusinessTrips: idList,

    chargesType: z.enum(ChargeFilterType).optional(),
    byChargeTypes: z.array(z.enum(ChargeType)).optional(),
    accountantStatus: z.array(z.enum(AccountantStatus)).optional(),

    freeText: searchText,
    excludedFreeText: searchText,

    withoutInvoice: z.boolean().optional(),
    withoutReceipt: z.boolean().optional(),
    withoutDocuments: z.boolean().optional(),
    withoutTransactions: z.boolean().optional(),
    withoutLedger: z.boolean().optional(),
    withoutTags: z.boolean().optional(),
    withOpenDocuments: z.boolean().optional(),
    withMissingCounterparty: z.boolean().optional(),
    unbalanced: z.boolean().optional(),

    sortBy: z.object({
      field: z.enum(ChargeSortByField),
      asc: z.boolean(),
    }),
  })
  .refine(value => !value.fromAnyDate || !value.toAnyDate || value.fromAnyDate <= value.toAnyDate, {
    message: 'From date must not be after To date',
    path: ['fromAnyDate'],
  });

export type ChargeFilterFormValues = z.infer<typeof chargeFilterFormSchema>;

/**
 * Seeds the form from an applied filter.
 *
 * Values round-tripped through the URL are parsed with a bare `JSON.parse`, so they
 * can be `null` (which would clobber a default) or structurally invalid (a stale or
 * hand-edited link). Nulls are stripped and the merged result is validated; on failure
 * we fall back to the defaults rather than opening the modal showing an error the user
 * never caused.
 */
export function filterToFormValues(
  filter: ChargeFilter,
  defaults: ChargeFilterFormValues,
): ChargeFilterFormValues {
  const provided = Object.fromEntries(
    Object.entries(filter).filter(([, value]) => value != null),
  ) as Partial<ChargeFilterFormValues>;

  const merged = { ...defaults, ...provided };
  const parsed = chargeFilterFormSchema.safeParse(merged);
  return parsed.success ? parsed.data : defaults;
}

/**
 * Maps form values back to the GraphQL input.
 *
 * `isObjectEmpty` (used by `encodeFilters` and the active-filter count) treats any
 * defined value as active, so every "unset" state has to collapse to `undefined`:
 * empty strings, empty arrays, `false` switches, and `chargesType: ALL` — which is the
 * absence of a constraint, not a constraint. Leaving any of them in would light up the
 * trigger badge and write a pointless `?chargesFilters=` into the URL.
 */
export function formValuesToFilter(values: ChargeFilterFormValues): ChargeFilter {
  const trim = (text?: string): string | undefined => text?.trim() || undefined;
  const list = (values_?: string[]): string[] | undefined =>
    values_ && values_.length > 0 ? values_ : undefined;
  const flag = (value?: boolean): boolean | undefined => value || undefined;

  return {
    fromAnyDate: values.fromAnyDate as TimelessDateString | undefined,
    toAnyDate: values.toAnyDate as TimelessDateString | undefined,

    byOwners: list(values.byOwners),
    byBusinesses: list(values.byBusinesses),
    excludedBusinesses: list(values.excludedBusinesses),
    byFinancialAccounts: list(values.byFinancialAccounts),
    excludedFinancialAccounts: list(values.excludedFinancialAccounts),
    byTags: list(values.byTags),
    excludedTags: list(values.excludedTags),
    byBusinessTrips: list(values.byBusinessTrips),

    chargesType:
      values.chargesType && values.chargesType !== ChargeFilterType.All
        ? values.chargesType
        : undefined,
    byChargeTypes: list(values.byChargeTypes) as ChargeType[] | undefined,
    accountantStatus: list(values.accountantStatus) as AccountantStatus[] | undefined,

    freeText: trim(values.freeText),
    excludedFreeText: trim(values.excludedFreeText),

    withoutInvoice: flag(values.withoutInvoice),
    withoutReceipt: flag(values.withoutReceipt),
    withoutDocuments: flag(values.withoutDocuments),
    withoutTransactions: flag(values.withoutTransactions),
    withoutLedger: flag(values.withoutLedger),
    withoutTags: flag(values.withoutTags),
    withOpenDocuments: flag(values.withOpenDocuments),
    withMissingCounterparty: flag(values.withMissingCounterparty),
    unbalanced: flag(values.unbalanced),

    sortBy: values.sortBy,
  };
}
