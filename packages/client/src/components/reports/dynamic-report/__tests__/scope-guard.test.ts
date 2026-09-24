import { describe, expect, it, vi } from 'vitest';
import { guardScopeChange } from '../utils/scope-guard.js';

describe('guardScopeChange', () => {
  it('runs the change straight away when nothing is staged', () => {
    const apply = vi.fn();
    const open = vi.fn();
    guardScopeChange({ hasStaged: false, open, apply });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it('holds the change and opens the prompt when statuses are staged', () => {
    const apply = vi.fn();
    const open = vi.fn();
    guardScopeChange({ hasStaged: true, open, apply });
    expect(apply).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(apply);
  });

  it('the held change runs only when the caller confirms', () => {
    const apply = vi.fn();
    const open = vi.fn<(pending: () => void) => void>();
    guardScopeChange({ hasStaged: true, open, apply });
    expect(apply).not.toHaveBeenCalled();
    const [held] = open.mock.calls[0];
    held();
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
