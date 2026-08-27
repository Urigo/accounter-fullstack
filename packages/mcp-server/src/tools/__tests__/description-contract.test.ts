import { describe, expect, it } from 'vitest';
import { toolRegistry } from '../registry-instance.js';

/**
 * The tool description is the only channel that reaches the model.
 *
 * Claude Desktop shows it neither `structuredContent` nor a declared
 * `outputSchema` — both measured, see `docs/connector-gaps-and-decisions.md`.
 * Asked what a tool returns, the model could infer that rows existed and could
 * not determine what they were keyed under. Anything it needs about a result
 * has to be written in prose.
 *
 * These are mechanical guards on that prose. They cannot judge whether a
 * description is *good*; they check the two properties that are objectively
 * checkable and were objectively missing.
 */

/** Every tool that shapes rows into the shared list envelope, and its key. */
const LIST_TOOLS: ReadonlyArray<readonly [tool: string, itemsKey: string]> = [
  ['accounter_list_business_memberships', 'businesses'],
  ['accounter_explain_terminology', 'terms'],
  ['accounter_search_charges', 'charges'],
  ['accounter_get_charges', 'charges'],
  ['accounter_get_transactions', 'transactions'],
  ['accounter_get_documents', 'documents'],
  ['accounter_get_ledger_records', 'ledgerRecords'],
  ['accounter_list_clients', 'clients'],
  ['accounter_get_contracts', 'contracts'],
  ['accounter_list_security_holdings', 'holdings'],
  ['accounter_get_security_executions', 'executions'],
  ['accounter_list_tags', 'tags'],
  ['accounter_list_tax_categories', 'taxCategories'],
  ['accounter_list_businesses', 'businesses'],
  ['accounter_balance_report', 'rows'],
];

function describedBy(name: string): string {
  const tool = toolRegistry.list().find(t => t.name === name);
  expect(tool, `${name} is not registered`).toBeDefined();
  return tool!.description;
}

describe('tool descriptions are well-formed', () => {
  /**
   * A description is assembled by concatenating string literals, which makes it
   * easy to leave a stray `\n` escape or a doubled space at a join. Both reach
   * the model verbatim and both are invisible in a diff — this was written
   * after doing exactly that.
   */
  it.each(toolRegistry.list().map(tool => [tool.name, tool.description] as const))(
    '%s is one clean line',
    (name, description) => {
      expect(description, `${name} contains a line break`).not.toMatch(/[\n\r]/);
      expect(description, `${name} contains a doubled space`).not.toMatch(/ {2}/);
      expect(description.trim(), `${name} has stray outer whitespace`).toBe(description);
    },
  );
});

describe('tool descriptions document their own result', () => {
  it('covers every list-producing tool in the registry', () => {
    // A tool added later must be added here too, or its description goes
    // unchecked — which is exactly how the gap this fixes came about.
    const listed = new Set(LIST_TOOLS.map(([name]) => name));
    const writeTools = toolRegistry
      .list()
      .filter(tool => tool.policy.mutating)
      .map(tool => tool.name);
    const unaccounted = toolRegistry
      .list()
      .map(tool => tool.name)
      .filter(name => !listed.has(name) && !writeTools.includes(name));

    expect(unaccounted, 'these tools are neither listed above nor write tools').toEqual([]);
  });

  it.each(LIST_TOOLS)('%s names the key its rows arrive under (`%s`)', (name, itemsKey) => {
    expect(
      describedBy(name),
      `${name} never tells the model its rows are under \`${itemsKey}\` — it cannot find them`,
    ).toContain(`\`${itemsKey}\``);
  });

  it.each(LIST_TOOLS)('%s documents the result envelope', (name, _itemsKey) => {
    const description = describedBy(name);

    // Emitted by `resultEnvelopeDescription`, so this also catches a tool that
    // hand-rolls the sentence and drifts from what the envelope really carries.
    for (const field of ['returnedCount', 'totalCount', 'truncated', 'continuation']) {
      expect(description, `${name} does not document \`${field}\``).toContain(`\`${field}\``);
    }
  });

  /**
   * The write tools shape a different envelope, and documented nothing about it
   * — a model that has just changed data could not tell from the description
   * what confirmation to expect, including that `itemsOmitted` means the write
   * applied and only the echo was dropped.
   */
  it.each([
    ['accounter_update_charges_tags', 'charges'],
    ['accounter_upload_documents', 'results'],
  ])('%s documents its write result (`%s`)', (name, itemsKey) => {
    const description = describedBy(name);

    for (const field of [itemsKey, 'ok', 'action', 'itemsOmitted']) {
      expect(description, `${name} does not document \`${field}\``).toContain(`\`${field}\``);
    }
  });

  /**
   * Deferred loading means the model sees roughly the first sentence until it
   * chooses to load the full definition. A first sentence that only restates
   * the tool's own name spends that budget on nothing.
   */
  it.each(LIST_TOOLS)('%s says what it returns in its first sentence', (name, _itemsKey) => {
    const [first = ''] = describedBy(name).split(/(?<=\.)\s/);

    expect(first.length, `${name}'s first sentence is too thin to decide on`).toBeGreaterThan(40);
  });
});
