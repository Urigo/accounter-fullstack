import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { OperationResult } from 'urql';
import { handleCommonErrors } from '../helpers/error-handling.js';

const { toastErrorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: toastErrorMock },
}));

function result(error: unknown): OperationResult<{ field: string }> {
  return { error } as unknown as OperationResult<{ field: string }>;
}

/** The description of the error toast `handleCommonErrors` raised */
function reportedDescription(): unknown {
  expect(toastErrorMock).toHaveBeenCalledTimes(1);
  return toastErrorMock.mock.calls[0][1].description;
}

describe('handleCommonErrors', () => {
  let consoleError: MockInstance;

  beforeEach(() => {
    toastErrorMock.mockReset();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("reports a GraphQL error without a code with the server's message", () => {
    const data = handleCommonErrors(
      result({ graphQLErrors: [{ message: 'Sort code 990 not found', extensions: {} }] }),
      'Error saving securities settings',
      'notification',
    );

    expect(data).toBeUndefined();
    expect(reportedDescription()).toBe('Error saving securities settings: Sort code 990 not found');
  });

  it("reports a GraphQL error with a code with the server's message alone", () => {
    handleCommonErrors(
      result({ graphQLErrors: [{ message: 'Not allowed', extensions: { code: 'FORBIDDEN' } }] }),
      'Error saving securities settings',
      'notification',
    );

    expect(reportedDescription()).toBe('Not allowed');
  });

  it('reports a network error generically', () => {
    handleCommonErrors(
      result({ graphQLErrors: [], networkError: new Error('offline') }),
      'Error saving securities settings',
      'notification',
    );

    expect(reportedDescription()).toBe('Error saving securities settings: Error occurred');
  });
});
