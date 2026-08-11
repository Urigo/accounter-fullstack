import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OperationResult } from 'urql';
import { handleUrqlError } from '../providers/urql-error-handler.js';

const { toastErrorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: toastErrorMock },
}));

function resultWithCode(code: string): OperationResult {
  return {
    error: { graphQLErrors: [{ message: 'nope', extensions: { code } }] },
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
});
