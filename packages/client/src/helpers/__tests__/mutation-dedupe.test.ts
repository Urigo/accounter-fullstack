import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimMutationCall, resetMutationDedupe } from '../mutation-dedupe.js';

const WINDOW = 20_000;

describe('claimMutationCall', () => {
  // A fresh document per test keeps the module-level guard from leaking between tests.
  let document: object;
  beforeEach(() => {
    document = {};
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('blocks an identical call while the first is in flight', () => {
    expect(claimMutationCall(document, { id: 1 }, WINDOW)).not.toBeNull();
    expect(claimMutationCall(document, { id: 1 }, WINDOW)).toBeNull();
  });

  it('does not block different variables or a different document', () => {
    expect(claimMutationCall(document, { id: 1 }, WINDOW)).not.toBeNull();
    expect(claimMutationCall(document, { id: 2 }, WINDOW)).not.toBeNull();
    expect(claimMutationCall({}, { id: 1 }, WINDOW)).not.toBeNull();
  });

  it('keeps the guard for the window after `release(true)`, then allows the call again', () => {
    vi.useFakeTimers();
    claimMutationCall(document, { id: 1 }, WINDOW)!(true);

    vi.advanceTimersByTime(WINDOW - 1);
    expect(claimMutationCall(document, { id: 1 }, WINDOW)).toBeNull();
    vi.advanceTimersByTime(2);
    expect(claimMutationCall(document, { id: 1 }, WINDOW)).not.toBeNull();
  });

  it('lifts the guard at once after `release(false)`', () => {
    claimMutationCall(document, { id: 1 }, WINDOW)!(false);
    expect(claimMutationCall(document, { id: 1 }, WINDOW)).not.toBeNull();
  });

  it('forgets every call on reset, as on a business-scope switch or logout', () => {
    // Most mutations take their owner from the request scope, so the same variables after a
    // switch are a different operation.
    claimMutationCall(document, { name: 'travel' }, WINDOW)!(true);
    resetMutationDedupe();
    expect(claimMutationCall(document, { name: 'travel' }, WINDOW)).not.toBeNull();
  });
});
