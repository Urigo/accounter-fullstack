import { describe, expect, it } from 'vitest';
import { LIST_BUSINESS_MEMBERSHIPS_TOOL_NAME } from '../businesses.js';
import { toolRegistry } from '../registry-instance.js';

/**
 * `ToolRegistry.describe()` preserves registration order, and that order is what
 * `tools/list` advertises to the model. Discovery leading the list is a
 * deliberate prompt-engineering choice, not an accident of import order — so it
 * is locked here.
 */
describe('production tool registry', () => {
  it('advertises the discovery tool first', () => {
    expect(toolRegistry.describe()[0]?.name).toBe(LIST_BUSINESS_MEMBERSHIPS_TOOL_NAME);
  });

  it('registers the discovery tool with a parameterless schema', () => {
    const descriptor = toolRegistry
      .describe()
      .find(tool => tool.name === LIST_BUSINESS_MEMBERSHIPS_TOOL_NAME);

    expect(descriptor).toBeDefined();
    expect(descriptor?.inputSchema).toMatchObject({
      type: 'object',
      additionalProperties: false,
    });
    // No required parameters — the model can always call it cold.
    expect(descriptor?.inputSchema.required).toBeUndefined();
  });

  // A model asked "how much did we make this year" reaches for whichever
  // plausible tool it sees first. If `search_charges` led, it would rebuild
  // bookkeeping from raw rows — the failure the report tools exist to prevent —
  // so the ordering is behaviour, not cosmetics.
  it('advertises the report tools ahead of the row-level ones', () => {
    const order = toolRegistry.describe().map(tool => tool.name);
    const positionOf = (name: string) => {
      const index = order.indexOf(name);
      expect(index, `${name} is not registered`).toBeGreaterThanOrEqual(0);
      return index;
    };

    const lastReport = Math.max(
      positionOf('accounter_list_accounts'),
      positionOf('accounter_income_expense_summary'),
      positionOf('accounter_profit_and_loss'),
      positionOf('accounter_vat_report'),
      positionOf('accounter_counterparty_totals'),
    );
    const firstRowLevel = Math.min(
      positionOf('accounter_search_charges'),
      positionOf('accounter_get_charges'),
      positionOf('accounter_get_transactions'),
      positionOf('accounter_get_documents'),
    );

    expect(lastReport).toBeLessThan(firstRowLevel);
    // Account structure is what makes any row-level answer interpretable.
    expect(positionOf('accounter_list_accounts')).toBeLessThan(
      positionOf('accounter_income_expense_summary'),
    );
  });
});
