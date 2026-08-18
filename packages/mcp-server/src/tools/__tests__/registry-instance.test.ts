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

  it('registers every mutating tool after every read tool', () => {
    // Registration order is what `tools/list` advertises. Reads first is a
    // deliberate prompt-engineering choice: a tool that changes data should not
    // be the first thing the model reaches for.
    const tools = toolRegistry.list();
    const firstWrite = tools.findIndex(tool => tool.policy.mutating);
    expect(firstWrite).toBeGreaterThan(0);
    expect(tools.slice(firstWrite).every(tool => tool.policy.mutating)).toBe(true);
  });

  it('gives every mutating tool a role gate and a single-business scope', () => {
    for (const tool of toolRegistry.list().filter(t => t.policy.mutating)) {
      expect(tool.policy.requiresBusinessScope, `${tool.name} must be scope-gated`).toBe(true);
      expect(tool.policy.requiredRoles, `${tool.name} must gate on a role`).toEqual(
        expect.arrayContaining(['business_owner', 'accountant']),
      );
    }
  });
});
