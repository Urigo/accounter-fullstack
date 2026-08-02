import { describe, expect, it } from 'vitest';
import { isToolAllowed } from '../allowlist.js';

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
