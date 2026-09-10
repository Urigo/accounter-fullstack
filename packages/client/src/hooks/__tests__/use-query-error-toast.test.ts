// @vitest-environment happy-dom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CombinedError } from 'urql';
import { useQueryErrorToast } from '../use-query-error-toast.js';

const { toastErrorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: toastErrorMock },
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeError(message: string): CombinedError {
  return { message, graphQLErrors: [], name: 'CombinedError' } as unknown as CombinedError;
}

function Harness({ error, subject }: { error?: CombinedError; subject: string }): null {
  useQueryErrorToast(error, subject);
  return null;
}

let container: HTMLDivElement;
let root: Root;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

/** Renders the harness, or re-renders it in place when already mounted. */
async function render(props: { error?: CombinedError; subject: string }): Promise<void> {
  await act(async () => {
    root.render(React.createElement(Harness, props));
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
    await Promise.resolve();
  });
  container.remove();
  consoleErrorSpy.mockRestore();
});

describe('useQueryErrorToast', () => {
  it('stays silent when there is no error', async () => {
    await render({ subject: 'businesses' });

    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('toasts once for an error, and logs the subject', async () => {
    await render({ error: makeError('boom'), subject: 'businesses' });

    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('businesses'));
  });

  it('does not re-toast when re-rendered with the same error', async () => {
    // The regression this hook exists for: the previous inline form ran in the
    // hook body, so it fired on every render while `error` was set — and React
    // StrictMode double-invokes.
    const error = makeError('boom');

    await render({ error, subject: 'businesses' });
    await render({ error, subject: 'businesses' });
    await render({ error, subject: 'businesses' });

    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });

  it('toasts again when the error changes', async () => {
    await render({ error: makeError('first'), subject: 'businesses' });
    await render({ error: makeError('second'), subject: 'businesses' });

    expect(toastErrorMock).toHaveBeenCalledTimes(2);
  });

  it('keys the toast on the subject so repeats replace rather than stack', async () => {
    await render({ error: makeError('boom'), subject: 'tax categories' });

    expect(toastErrorMock).toHaveBeenCalledWith(
      'Error',
      expect.objectContaining({
        id: 'fetch-tax categories',
        description: 'Unable to fetch tax categories',
      }),
    );
  });
});
