import { z } from 'zod';
import type { BusinessFilter } from '../../../gql/graphql.js';

/** URL query parameter the applied filter is persisted under. */
export const BUSINESSES_FILTER_PARAM = 'businessesFilters';

/**
 * Option value standing for "has none" in the tax category and sort code selects. The server
 * takes that as a separate `without*` flag, OR-ed with the selected ids.
 */
export const NONE_OPTION_VALUE = '__none__';

/**
 * The filter the businesses page applies: the server's `BusinessFilter` input plus `unusedOnly`,
 * which can only be applied in the browser (it reads the lazily loaded usage counts).
 */
export type BusinessesPageFilter = BusinessFilter & { unusedOnly?: boolean | null };

// Validated as tightly as the server's scalars, so a hand-edited link falls back to no filter
// instead of failing the whole directory query.
const businessesPageFilterSchema = z.object({
  name: z.string().optional(),
  taxCategoryIds: z.array(z.guid()).optional(),
  withoutTaxCategory: z.boolean().optional(),
  sortCodes: z.array(z.number().int()).optional(),
  withoutSortCode: z.boolean().optional(),
  countries: z.array(z.string().regex(/^[A-Za-z]{3}$/)).optional(),
  isClient: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
  unusedOnly: z.boolean().optional(),
});

/** Drops `null` / `undefined` entries, so they neither fail parsing nor read as active. */
function withoutNullish<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry != null),
  ) as Partial<T>;
}

const FILTER_KEYS = [
  'name',
  'taxCategoryIds',
  'withoutTaxCategory',
  'sortCodes',
  'withoutSortCode',
  'countries',
  'isClient',
  'isActive',
  'isAdmin',
  'unusedOnly',
] as const satisfies readonly (keyof BusinessesPageFilter)[];

/**
 * The canonical form of a filter: a fixed key order with unset values (nullish, blank, empty
 * lists) dropped. Every filter the page stores goes through it, so two equal filters encode to
 * the same URL string — which is what the equality checks guarding re-renders, re-queries and
 * history entries compare.
 */
export function normalizeBusinessesFilter(filter: BusinessesPageFilter): BusinessesPageFilter {
  const normalized: Record<string, unknown> = {};
  for (const key of FILTER_KEYS) {
    const value = filter[key];
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
      continue;
    }
    normalized[key] = value;
  }
  return normalized as BusinessesPageFilter;
}

/** Whether two filters are the same, regardless of key order or unset values. */
export function areFiltersEqual(a: BusinessesPageFilter, b: BusinessesPageFilter): boolean {
  return (
    JSON.stringify(normalizeBusinessesFilter(a)) === JSON.stringify(normalizeBusinessesFilter(b))
  );
}

/**
 * Reads the applied filter back from its URL parameter.
 *
 * The parameter is untrusted (a stale or hand-edited link), so anything that doesn't parse —
 * malformed JSON, a wrong shape — falls back to no filter rather than to an error page.
 */
export function parseBusinessesFilterParam(param: string | null): BusinessesPageFilter {
  if (!param) {
    return {};
  }
  try {
    const raw: unknown = JSON.parse(decodeURIComponent(param));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }
    const parsed = businessesPageFilterSchema.safeParse(withoutNullish(raw));
    return parsed.success ? normalizeBusinessesFilter(parsed.data) : {};
  } catch {
    return {};
  }
}

/** Strips the client-only `unusedOnly`, leaving the input the `allBusinesses` query takes. */
export function toServerFilter(filter: BusinessesPageFilter): BusinessFilter {
  const { unusedOnly: _unusedOnly, ...serverFilter } = filter;
  return withoutNullish(serverFilter);
}

/**
 * Number of active filters behind the dialog trigger, counting each selected option. The name
 * search lives in the toolbar, in plain sight, so it is not counted here.
 */
export function countActiveFilters(filter: BusinessesPageFilter): number {
  return (
    (filter.taxCategoryIds?.length ?? 0) +
    (filter.withoutTaxCategory ? 1 : 0) +
    (filter.sortCodes?.length ?? 0) +
    (filter.withoutSortCode ? 1 : 0) +
    (filter.countries?.length ?? 0) +
    (filter.isClient == null ? 0 : 1) +
    (filter.isActive == null ? 0 : 1) +
    (filter.isAdmin == null ? 0 : 1) +
    (filter.unusedOnly ? 1 : 0)
  );
}

/** True when anything narrows the directory, the name search included. */
export function hasActiveFilters(filter: BusinessesPageFilter): boolean {
  return !!filter.name?.trim() || countActiveFilters(filter) > 0;
}

export const businessesFilterFormSchema = z.object({
  /** Tax category ids, plus {@link NONE_OPTION_VALUE} for "no tax category". */
  taxCategories: z.array(z.string()).optional(),
  /** Sort code keys as strings, plus {@link NONE_OPTION_VALUE} for "no sort code". */
  sortCodes: z.array(z.string()).optional(),
  countries: z.array(z.string()).optional(),
  /** Tri-state: `undefined` is "any". */
  isClient: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
  unusedOnly: z.boolean().optional(),
});

export type BusinessesFilterFormValues = z.infer<typeof businessesFilterFormSchema>;

const listOrUndefined = <T>(values: T[]): T[] | undefined =>
  values.length > 0 ? values : undefined;

/** Seeds the dialog form from the applied filter. */
export function filterToFormValues(filter: BusinessesPageFilter): BusinessesFilterFormValues {
  return {
    taxCategories: listOrUndefined([
      ...(filter.withoutTaxCategory ? [NONE_OPTION_VALUE] : []),
      ...(filter.taxCategoryIds ?? []),
    ]),
    sortCodes: listOrUndefined([
      ...(filter.withoutSortCode ? [NONE_OPTION_VALUE] : []),
      ...(filter.sortCodes ?? []).map(String),
    ]),
    countries: listOrUndefined([...(filter.countries ?? [])]),
    isClient: filter.isClient ?? undefined,
    isActive: filter.isActive ?? undefined,
    isAdmin: filter.isAdmin ?? undefined,
    unusedOnly: filter.unusedOnly || undefined,
  };
}

/**
 * Maps the dialog form back to the filter, leaving out the name search (owned by the toolbar).
 *
 * Every unset state collapses to `undefined` — an empty list, an unchecked switch — because
 * `encodeFilters` treats any defined value as active: a stray `[]` would light up the trigger
 * badge and write a pointless parameter into the URL. A tri-state `false` is kept: "not a
 * client" is a real constraint.
 */
export function formValuesToFilter(
  values: BusinessesFilterFormValues,
): Omit<BusinessesPageFilter, 'name'> {
  const taxCategories = values.taxCategories ?? [];
  const sortCodes = values.sortCodes ?? [];
  return {
    taxCategoryIds: listOrUndefined(taxCategories.filter(value => value !== NONE_OPTION_VALUE)),
    withoutTaxCategory: taxCategories.includes(NONE_OPTION_VALUE) || undefined,
    sortCodes: listOrUndefined(
      sortCodes
        .filter(value => value !== NONE_OPTION_VALUE)
        .map(Number)
        .filter(Number.isInteger),
    ),
    withoutSortCode: sortCodes.includes(NONE_OPTION_VALUE) || undefined,
    countries: listOrUndefined(values.countries ?? []),
    isClient: values.isClient,
    isActive: values.isActive,
    isAdmin: values.isAdmin,
    unusedOnly: values.unusedOnly || undefined,
  };
}
