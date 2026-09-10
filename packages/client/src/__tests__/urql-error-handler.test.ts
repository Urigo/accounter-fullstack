import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OperationResult } from 'urql';
import { handleUrqlError } from '../providers/urql-error-handler.js';

const { toastErrorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: toastErrorMock },
}));

type OperationKind = 'query' | 'mutation' | 'subscription' | 'teardown';

// `kind` is omitted by default on purpose: a result carrying no `operation` at
// all must still toast, and the two original cases below cover that.
function resultWithCode(code: string, kind?: OperationKind): OperationResult {
  return {
    error: { graphQLErrors: [{ message: 'nope', extensions: { code } }] },
    ...(kind ? { operation: { kind } } : {}),
  } as unknown as OperationResult;
}

function networkErrorResult(kind?: OperationKind): OperationResult {
  return {
    error: { networkError: new Error('offline') },
    ...(kind ? { operation: { kind } } : {}),
  } as unknown as OperationResult;
}

describe('handleUrqlError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toasts ordinary GraphQL errors', () => {
    handleUrqlError(resultWithCode('FORBIDDEN'));

    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });

  it('stays silent for ONBOARDING_REQUIRED', () => {
    // Every guarded operation fails at once for an unprovisioned account; the
    // /welcome screen is the message, so toasts would only pile up behind it.
    handleUrqlError(resultWithCode('ONBOARDING_REQUIRED'));

    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('stays silent for a failing mutation', () => {
    // Mutations already toast through `handleCommonErrors`, which produces the
    // better message: entity-scoped, dismissible, and keyed so the loading
    // toast is replaced in place rather than stacked on.
    handleUrqlError(resultWithCode('FORBIDDEN', 'mutation'));

    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('toasts a failing query', () => {
    handleUrqlError(resultWithCode('FORBIDDEN', 'query'));

    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });

  it('still toasts a network error on a mutation', () => {
    // A mutation that never reached the server is the one case the hook layer
    // cannot describe — `handleCommonErrors` only manages a generic "Error
    // occurred" for it — so the global handler keeps this one.
    handleUrqlError(networkErrorResult('mutation'));

    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });
});
