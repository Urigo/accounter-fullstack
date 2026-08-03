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
});
