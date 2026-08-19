import { describe, expect, it } from 'vitest';
import { isToolAllowed, isToolExposed } from '../allowlist.js';

describe('isToolAllowed', () => {
  it('permits every tool when the allowlist is empty (no restriction)', () => {
    expect(isToolAllowed([], 'accounter_list_businesses')).toBe(true);
    expect(isToolAllowed([], 'anything_at_all')).toBe(true);
  });

  it('permits only named tools when the allowlist is non-empty', () => {
    const allowlist = ['accounter_list_businesses', 'accounter_search_charges'];
    expect(isToolAllowed(allowlist, 'accounter_list_businesses')).toBe(true);
    expect(isToolAllowed(allowlist, 'accounter_search_charges')).toBe(true);
    expect(isToolAllowed(allowlist, 'accounter_balance_report')).toBe(false);
  });
});

describe('isToolExposed', () => {
  const read = { name: 'accounter_list_tags', policy: {} };
  const write = { name: 'accounter_update_charges_tags', policy: { mutating: true } };

  it('hides mutating tools while the write switch is off', () => {
    const options = { allowlist: [], writeToolsEnabled: false };
    expect(isToolExposed(read, options)).toBe(true);
    expect(isToolExposed(write, options)).toBe(false);
  });

  it('exposes mutating tools once the write switch is on', () => {
    expect(isToolExposed(write, { allowlist: [], writeToolsEnabled: true })).toBe(true);
  });

  it('cannot be turned on by the allowlist alone', () => {
    // The two controls compose one way only: naming a write tool must never
    // grant write access that MCP_ENABLE_WRITE_TOOLS has not granted.
    expect(isToolExposed(write, { allowlist: [write.name], writeToolsEnabled: false })).toBe(false);
  });

  it('still honors the allowlist when writes are enabled', () => {
    const options = { allowlist: [read.name], writeToolsEnabled: true };
    expect(isToolExposed(read, options)).toBe(true);
    expect(isToolExposed(write, options)).toBe(false);
  });
});
