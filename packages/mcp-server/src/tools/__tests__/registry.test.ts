import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  DuplicateToolError,
  type ToolDefinition,
  ToolRegistry,
  validateToolInput,
} from '../registry.js';

function makeTool(name: string): ToolDefinition {
  return {
    name,
    description: `desc for ${name}`,
    inputSchema: z.object({ query: z.string(), limit: z.number().int().optional() }),
    policy: { requiresBusinessScope: true, dataClassification: 'business' },
    handler: input => ({ content: [{ type: 'text', text: JSON.stringify(input) }] }),
  };
}

describe('ToolRegistry', () => {
  it('registers and looks up a tool', () => {
    const registry = new ToolRegistry();
    const tool = makeTool('charges_search');
    registry.register(tool);

    expect(registry.has('charges_search')).toBe(true);
    expect(registry.get('charges_search')).toBe(tool);
    expect(registry.get('missing')).toBeUndefined();
  });

  it('rejects duplicate names', () => {
    const registry = new ToolRegistry();
    registry.register(makeTool('dup'));
    expect(() => registry.register(makeTool('dup'))).toThrow(DuplicateToolError);
  });

  it('preserves registration order in list()', () => {
    const registry = new ToolRegistry();
    registry.register(makeTool('a'));
    registry.register(makeTool('b'));
    registry.register(makeTool('c'));
    expect(registry.list().map(t => t.name)).toEqual(['a', 'b', 'c']);
  });

  it('describes tools with JSON-Schema input (unknown fields disallowed)', () => {
    const registry = new ToolRegistry();
    registry.register(makeTool('charges_search'));
    const [descriptor] = registry.describe();

    expect(descriptor.name).toBe('charges_search');
    expect(descriptor.inputSchema.type).toBe('object');
    expect(descriptor.inputSchema.additionalProperties).toBe(false);
    expect(descriptor.inputSchema.required).toEqual(['query']);
  });
});

describe('validateToolInput', () => {
  const tool = makeTool('charges_search');

  it('accepts valid input and returns typed data', () => {
    const result = validateToolInput(tool, { query: 'acme', limit: 10 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ query: 'acme', limit: 10 });
    }
  });

  it('defaults missing args to an empty object (still validated)', () => {
    const result = validateToolInput(tool, undefined);
    // query is required, so an empty object fails deterministically
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.issues.some(i => i.path === 'query')).toBe(true);
    }
  });

  it('rejects unknown fields with a deterministic payload', () => {
    const result = validateToolInput(tool, { query: 'x', bogus: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('Invalid tool input');
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('reports the field path for a type mismatch', () => {
    const result = validateToolInput(tool, { query: 123 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.some(i => i.path === 'query')).toBe(true);
    }
  });
});
