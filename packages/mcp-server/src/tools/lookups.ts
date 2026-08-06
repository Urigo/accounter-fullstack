import { z } from 'zod';
import type {
  McpListBusinessesQuery,
  McpListTagsQuery,
  McpListTaxCategoriesQuery,
} from '../gql/index.js';
import { shapeListResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';
import { businessIdsInput, SCOPE_DESCRIPTION_SUFFIX } from './scope-input.js';

/**
 * Tool 2: read-only lookups for tags, tax categories, and businesses (spec §8.2).
 *
 * These are reference-data lookups. Input is minimal, output is deterministically
 * sorted (by name, then id) and size-capped. A caller must belong to at least
 * one business (scope-gated) to browse them.
 */

export const LIST_TAGS_TOOL_NAME = 'accounter_list_tags';
export const LIST_TAX_CATEGORIES_TOOL_NAME = 'accounter_list_tax_categories';
export const LIST_BUSINESSES_TOOL_NAME = 'accounter_list_businesses';

/** Hard cap on returned rows (spec §9.3). */
export const MAX_LOOKUP_RESULTS = 1000;

const nameContains = z
  .string()
  .min(1)
  .max(100)
  .optional()
  .describe('Case-insensitive substring to filter by name.');

const limit = z
  .number()
  .int()
  .positive()
  .max(MAX_LOOKUP_RESULTS)
  .optional()
  .default(MAX_LOOKUP_RESULTS)
  .describe(`Maximum rows to return (capped at ${MAX_LOOKUP_RESULTS}).`);

// Fixed-locale collator so the ordering is deterministic across hosts/runtimes
// rather than depending on the ambient default locale.
const NAME_COLLATOR = new Intl.Collator('en', { sensitivity: 'base' });

/** Stable order: by name (case-insensitive, fixed-locale), tie-broken by id. */
function byNameThenId(a: { name: string; id: string }, b: { name: string; id: string }): number {
  return NAME_COLLATOR.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function filterSortCap<T extends { name: string; id: string }>(
  rows: T[],
  search: string | undefined,
  max: number,
): { rows: T[]; total: number } {
  const needle = search?.toLowerCase();
  const filtered = needle ? rows.filter(row => row.name.toLowerCase().includes(needle)) : rows;
  const sorted = [...filtered].sort(byNameThenId);
  // `total` is the full match count; the byte-guard/continuation is applied by
  // shapeListResult against this total.
  return { rows: sorted.slice(0, max), total: filtered.length };
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

const listTagsInput = z.object({ businessIds: businessIdsInput, nameContains, limit });
type ListTagsInput = z.infer<typeof listTagsInput>;

const LIST_TAGS_QUERY = /* GraphQL */ `
  query McpListTags {
    allTags {
      id
      name
      namePath
      ownerId
    }
  }
`;

async function listTagsHandler(
  input: ListTagsInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const data = await context.client.query<McpListTagsQuery>(
    { query: LIST_TAGS_QUERY },
    context.upstream,
  );

  const { rows, total } = filterSortCap(data.allTags, input.nameContains, input.limit);
  const tags = rows.map(tag => ({
    id: tag.id,
    name: tag.name,
    ownerId: tag.ownerId,
    namePath: tag.namePath ?? [tag.name],
  }));

  return shapeListResult({
    items: tags,
    itemsKey: 'tags',
    total,
    extra: { scope: { businessIds: context.readScope.businessIds } },
    summarize: (_shown, count, truncated) =>
      `Found ${count} ${count === 1 ? 'tag' : 'tags'}${truncated ? ' (truncated)' : ''}.`,
  });
}

export const listTagsTool: ToolDefinition<typeof listTagsInput> = {
  name: LIST_TAGS_TOOL_NAME,
  description:
    'List the tags available for categorizing charges, optionally filtered by name. Read-only. ' +
    SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: listTagsInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler: listTagsHandler,
};

// ---------------------------------------------------------------------------
// Tax categories
// ---------------------------------------------------------------------------

const listTaxCategoriesInput = z.object({
  businessIds: businessIdsInput,
  nameContains,
  activeOnly: z.boolean().optional().default(false).describe('Return only active tax categories.'),
  limit,
});
type ListTaxCategoriesInput = z.infer<typeof listTaxCategoriesInput>;

const LIST_TAX_CATEGORIES_QUERY = /* GraphQL */ `
  query McpListTaxCategories {
    taxCategories {
      id
      name
      ownerId
      irsCode
      isActive
      sortCode {
        key
        name
      }
    }
  }
`;

async function listTaxCategoriesHandler(
  input: ListTaxCategoriesInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const data = await context.client.query<McpListTaxCategoriesQuery>(
    { query: LIST_TAX_CATEGORIES_QUERY },
    context.upstream,
  );

  const activeFiltered = input.activeOnly
    ? data.taxCategories.filter(category => category.isActive)
    : data.taxCategories;
  // `rows` are already `RawTaxCategory` with exactly the fields we expose.
  const { rows: taxCategories, total } = filterSortCap(
    activeFiltered,
    input.nameContains,
    input.limit,
  );

  return shapeListResult({
    items: taxCategories,
    itemsKey: 'taxCategories',
    total,
    extra: { scope: { businessIds: context.readScope.businessIds } },
    summarize: (_shown, count, truncated) =>
      `Found ${count} tax ${count === 1 ? 'category' : 'categories'}${
        truncated ? ' (truncated)' : ''
      }.`,
  });
}

export const listTaxCategoriesTool: ToolDefinition<typeof listTaxCategoriesInput> = {
  name: LIST_TAX_CATEGORIES_TOOL_NAME,
  description:
    'List tax categories (id, name, IRS code, active flag), optionally filtered by name or active status. Read-only. ' +
    SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: listTaxCategoriesInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler: listTaxCategoriesHandler,
};

// ---------------------------------------------------------------------------
// Businesses (full directory)
// ---------------------------------------------------------------------------

const listBusinessesInput = z.object({
  businessIds: businessIdsInput,
  nameContains,
  activeOnly: z.boolean().optional().default(false).describe('Return only active businesses.'),
  limit,
  // `allBusinesses(page:)` is the third upstream argument, and pinning it to the
  // first page made the directory unwalkable past `limit` rows with no way to
  // tell — the same gap the charge tools had. Exposed 1-based here (upstream is
  // 0-based) so it matches `page` on every other tool.
  page: z
    .number()
    .int()
    .positive()
    .optional()
    .default(1)
    .describe(
      '1-based page of the directory, each `limit` rows long. Upstream pages a name-ordered ' +
        'directory, so `activeOnly`/`nameContains` narrowing happens within the page and a page can ' +
        'come back short. Read `pagination.totalPages` to walk it.',
    ),
});
type ListBusinessesInput = z.infer<typeof listBusinessesInput>;

// `name` is forwarded to the upstream `allBusinesses(name:)` filter so the
// server narrows the directory before it is serialized, rather than shipping the
// whole businesses table on every call. The client-side `filterSortCap` below
// still runs: upstream matches Hebrew names too, so it re-applies the stricter
// English-name predicate (keeping `totalCount` accurate) and owns the
// deterministic global sort + size cap that all the lookups share.
const LIST_BUSINESSES_QUERY = /* GraphQL */ `
  query McpListBusinesses($name: String, $page: Int, $limit: Int) {
    allBusinesses(name: $name, page: $page, limit: $limit) {
      nodes {
        id
        name
        ownerId
        isActive
      }
      pageInfo {
        totalPages
        totalRecords
        currentPage
        pageSize
      }
    }
  }
`;

async function listBusinessesHandler(
  input: ListBusinessesInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const data = await context.client.query<McpListBusinessesQuery>(
    {
      query: LIST_BUSINESSES_QUERY,
      variables: {
        name: input.nameContains ?? null,
        // Upstream slices `[page * limit, (page + 1) * limit]`, so it is 0-based.
        page: input.page - 1,
        limit: input.limit,
      },
    },
    context.upstream,
  );

  const allBusinesses = data.allBusinesses?.nodes ?? [];
  const activeFiltered = input.activeOnly
    ? allBusinesses.filter(business => business.isActive)
    : allBusinesses;
  const { rows, total } = filterSortCap(activeFiltered, input.nameContains, input.limit);
  const businesses = rows.map(business => ({
    id: business.id,
    name: business.name,
    ownerId: business.ownerId,
    isActive: business.isActive,
  }));

  // `totalRecords` counts the whole (name-filtered) directory, not just this
  // page, so report it as the total and let `pagination` say where in it we are.
  // Never below the rows on hand: `activeOnly` can only shrink a page, and
  // `shapeListResult` clamps anyway.
  const pageInfo = data.allBusinesses?.pageInfo;
  const totalPages = pageInfo?.totalPages ?? 1;
  const pagination = {
    // Reported from the request: upstream echoes `currentPage` as the 0-based
    // index it was given, which would read as an off-by-one page number here.
    page: input.page,
    pageSize: input.limit,
    totalPages,
    hasNextPage: input.page < totalPages,
  };

  return shapeListResult({
    items: businesses,
    itemsKey: 'businesses',
    total: pageInfo?.totalRecords ?? total,
    extra: { pagination, scope: { businessIds: context.readScope.businessIds } },
    summarize: (shown, count, truncated) =>
      `Found ${count} ${count === 1 ? 'business' : 'businesses'}; showing ${shown} on page ${
        pagination.page
      } of ${pagination.totalPages}${truncated ? ' (truncated)' : ''}.`,
  });
}

// A dedicated scope clause rather than the shared `SCOPE_DESCRIPTION_SUFFIX`:
// this tool is the full directory, so "omitting `businessIds` covers every
// business you belong to" (the shared wording, written for the owner-scoped
// tags/tax-category lookups) would be wrong here. It still teaches the same
// convention — optional narrowing, `ownerId`-tagged rows, echoed scope, and the
// same discovery entry point.
const DIRECTORY_SCOPE_DESCRIPTION_SUFFIX =
  'Scope: omitting `businessIds` returns the whole directory visible to you; passing them narrows to ' +
  'those owning businesses. Rows are tagged with `ownerId` and the response echoes the effective ' +
  '`scope.businessIds`. If you have more than one business, call `accounter_list_business_memberships` ' +
  'first to discover ids.';

export const listBusinessesTool: ToolDefinition<typeof listBusinessesInput> = {
  name: LIST_BUSINESSES_TOOL_NAME,
  description:
    'List the full business directory (id, name, ownerId, active flag) — every business visible to you, not just the ones you are a member of — optionally filtered by name or active status, with `limit`/`page` pagination over the name-ordered directory. For your own memberships and roles use `accounter_list_business_memberships`. Read-only. ' +
    DIRECTORY_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: listBusinessesInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler: listBusinessesHandler,
};
