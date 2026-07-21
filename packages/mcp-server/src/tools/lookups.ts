import { z } from 'zod';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';

/**
 * Tool 2: read-only lookups for tags and tax categories (spec §8.2).
 *
 * These are reference-data lookups. Input is minimal, output is deterministically
 * sorted (by name, then id) and size-capped. A caller must belong to at least
 * one business (scope-gated) to browse them.
 */

export const LIST_TAGS_TOOL_NAME = 'accounter_list_tags';
export const LIST_TAX_CATEGORIES_TOOL_NAME = 'accounter_list_tax_categories';

/** Hard cap on returned rows (spec §9.3). */
export const MAX_LOOKUP_RESULTS = 500;

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

/** Stable order: by name (case-insensitive, locale-aware), tie-broken by id. */
function byNameThenId(a: { name: string; id: string }, b: { name: string; id: string }): number {
  return (
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id)
  );
}

function applyFilterSortCap<T extends { name: string; id: string }>(
  rows: T[],
  search: string | undefined,
  max: number,
): { rows: T[]; total: number; truncated: boolean } {
  const needle = search?.toLowerCase();
  const filtered = needle ? rows.filter(row => row.name.toLowerCase().includes(needle)) : rows;
  const sorted = [...filtered].sort(byNameThenId);
  return {
    rows: sorted.slice(0, max),
    total: filtered.length,
    truncated: filtered.length > max,
  };
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

const listTagsInput = z.object({ nameContains, limit });
type ListTagsInput = z.infer<typeof listTagsInput>;

const LIST_TAGS_QUERY = /* GraphQL */ `
  query McpListTags {
    allTags {
      id
      name
      namePath
    }
  }
`;

interface RawTag {
  id: string;
  name: string;
  namePath: string[] | null;
}

async function listTagsHandler(
  input: ListTagsInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const data = await context.client.query<{ allTags: RawTag[] }>(
    { query: LIST_TAGS_QUERY },
    { correlationId: context.correlationId, authorization: context.authorization },
  );

  const { rows, total, truncated } = applyFilterSortCap(
    data.allTags,
    input.nameContains,
    input.limit,
  );
  const tags = rows.map(tag => ({
    id: tag.id,
    name: tag.name,
    namePath: tag.namePath ?? [tag.name],
  }));

  return {
    content: [
      {
        type: 'text',
        text: `Found ${total} ${total === 1 ? 'tag' : 'tags'}${truncated ? ' (truncated)' : ''}.`,
      },
    ],
    structuredContent: { tags, total, truncated },
  };
}

export const listTagsTool: ToolDefinition<typeof listTagsInput> = {
  name: LIST_TAGS_TOOL_NAME,
  description:
    'List the tags available for categorizing charges, optionally filtered by name. Read-only.',
  inputSchema: listTagsInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler: listTagsHandler,
};

// ---------------------------------------------------------------------------
// Tax categories
// ---------------------------------------------------------------------------

const listTaxCategoriesInput = z.object({
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
      irsCode
      isActive
    }
  }
`;

interface RawTaxCategory {
  id: string;
  name: string;
  irsCode: number | null;
  isActive: boolean;
}

async function listTaxCategoriesHandler(
  input: ListTaxCategoriesInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const data = await context.client.query<{ taxCategories: RawTaxCategory[] }>(
    { query: LIST_TAX_CATEGORIES_QUERY },
    { correlationId: context.correlationId, authorization: context.authorization },
  );

  const activeFiltered = input.activeOnly
    ? data.taxCategories.filter(category => category.isActive)
    : data.taxCategories;
  // `rows` are already `RawTaxCategory` with exactly the fields we expose.
  const {
    rows: taxCategories,
    total,
    truncated,
  } = applyFilterSortCap(activeFiltered, input.nameContains, input.limit);

  return {
    content: [
      {
        type: 'text',
        text: `Found ${total} tax ${total === 1 ? 'category' : 'categories'}${
          truncated ? ' (truncated)' : ''
        }.`,
      },
    ],
    structuredContent: { taxCategories, total, truncated },
  };
}

export const listTaxCategoriesTool: ToolDefinition<typeof listTaxCategoriesInput> = {
  name: LIST_TAX_CATEGORIES_TOOL_NAME,
  description:
    'List tax categories (id, name, IRS code, active flag), optionally filtered by name or active status. Read-only.',
  inputSchema: listTaxCategoriesInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler: listTaxCategoriesHandler,
};
