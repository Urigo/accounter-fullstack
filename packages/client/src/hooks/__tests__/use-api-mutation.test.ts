// @vitest-environment happy-dom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TypedDocumentNode } from 'urql';
import {
  useApiMutation,
  type UseApiMutation,
  type UseApiMutationOptions,
} from '../use-api-mutation.js';

const { toastMock, useMutationMock } = vi.hoisted(() => {
  const success = vi.fn();
  const toast = Object.assign(vi.fn(), {
    success,
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  });
  return { toastMock: toast, useMutationMock: vi.fn() };
});

vi.mock('sonner', () => ({ toast: toastMock }));
vi.mock('urql', () => ({ useMutation: useMutationMock }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type Data = { addTag: boolean };
type Variables = { tagName: string };

/** Only its identity matters here: `useMutation` is mocked, so it is never parsed. */
const DOCUMENT = {} as TypedDocumentNode<Data, Variables>;

/** Resolves the mutation with `data`, as a successful urql `OperationResult` would. */
const resolveWith = (data: Data) => vi.fn().mockResolvedValue({ data });

async function renderHook<TResult>(
  options: UseApiMutationOptions<Data, Variables, undefined, TResult>,
) {
  const container = document.createElement('div');
  document.body.append(container);

  const renders: UseApiMutation<Variables, TResult>[] = [];

  function Harness(): null {
    renders.push(useApiMutation(options));
    return null;
  }

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(Harness));
  });

  return {
    renders,
    current: () => renders.at(-1)!,
    rerender: async () => {
      await act(async () => {
        root?.render(React.createElement(Harness));
      });
    },
  };
}

const baseOptions = {
  document: DOCUMENT,
  notificationId: 'addTag',
  loadingMessage: 'Adding tag',
  errorMessage: 'Error adding tag',
} satisfies Partial<UseApiMutationOptions<Data, Variables, undefined, unknown>>;

describe('useApiMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading toast, then a success toast under the same notification id', async () => {
    useMutationMock.mockReturnValue([{ fetching: false }, resolveWith({ addTag: true })]);

    const { current } = await renderHook({
      ...baseOptions,
      select: (data: Data) => data.addTag,
      successToast: { description: 'Tag added' },
    });

    await act(async () => {
      await current().execute({ tagName: 'travel' });
    });

    expect(toastMock.loading).toHaveBeenCalledWith('Adding tag', { id: 'addTag' });
    expect(toastMock.success).toHaveBeenCalledWith('Success', {
      description: 'Tag added',
      id: 'addTag',
    });
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('resolves to the selected result', async () => {
    useMutationMock.mockReturnValue([{ fetching: false }, resolveWith({ addTag: true })]);

    const { current } = await renderHook({
      ...baseOptions,
      select: (data: Data) => data.addTag,
    });

    let result: boolean | void = undefined;
    await act(async () => {
      result = await current().execute({ tagName: 'travel' });
    });

    expect(result).toBe(true);
  });

  it('derives the notification id and messages from the variables', async () => {
    useMutationMock.mockReturnValue([{ fetching: false }, resolveWith({ addTag: true })]);

    const { current } = await renderHook({
      ...baseOptions,
      notificationId: (variables: Variables) => `addTag-${variables.tagName}`,
      loadingMessage: (variables: Variables) => `Adding ${variables.tagName}`,
      successToast: (_result: unknown, variables: Variables) => ({
        description: `"${variables.tagName}" added`,
      }),
    });

    await act(async () => {
      await current().execute({ tagName: 'travel' });
    });

    expect(toastMock.loading).toHaveBeenCalledWith('Adding travel', { id: 'addTag-travel' });
    expect(toastMock.success).toHaveBeenCalledWith('Success', {
      description: '"travel" added',
      id: 'addTag-travel',
    });
  });

  it('raises the chosen toast variant', async () => {
    useMutationMock.mockReturnValue([{ fetching: false }, resolveWith({ addTag: true })]);

    const { current } = await renderHook({
      ...baseOptions,
      successToast: { variant: 'warning' as const, title: 'Partial success' },
    });

    await act(async () => {
      await current().execute({ tagName: 'travel' });
    });

    expect(toastMock.warning).toHaveBeenCalledWith('Partial success', { id: 'addTag' });
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('skips the success toast when `successToast` is false', async () => {
    useMutationMock.mockReturnValue([{ fetching: false }, resolveWith({ addTag: true })]);

    const { current } = await renderHook({ ...baseOptions, successToast: false as const });

    await act(async () => {
      await current().execute({ tagName: 'travel' });
    });

    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('runs `onSuccess` after a successful mutation', async () => {
    useMutationMock.mockReturnValue([{ fetching: false }, resolveWith({ addTag: true })]);
    const onSuccess = vi.fn();

    const { current } = await renderHook({
      ...baseOptions,
      select: (data: Data) => data.addTag,
      onSuccess,
    });

    await act(async () => {
      await current().execute({ tagName: 'travel' });
    });

    expect(onSuccess).toHaveBeenCalledWith(true, { tagName: 'travel' });
  });

  describe('failures', () => {
    it('reports a rejected mutation and resolves to undefined', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      useMutationMock.mockReturnValue([
        { fetching: false },
        vi.fn().mockRejectedValue(new Error('offline')),
      ]);

      const { current } = await renderHook({ ...baseOptions, select: (data: Data) => data.addTag });

      let result: boolean | void = true;
      await act(async () => {
        result = await current().execute({ tagName: 'travel' });
      });

      expect(result).toBeUndefined();
      expect(toastMock.success).not.toHaveBeenCalled();
      expect(toastMock.error).toHaveBeenCalledWith('Error', {
        description: 'Error adding tag',
        duration: 100_000,
        closeButton: true,
        id: 'addTag',
      });
      consoleError.mockRestore();
    });

    it('treats a throw from `select` as a failure', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      useMutationMock.mockReturnValue([{ fetching: false }, resolveWith({ addTag: false })]);

      const { current } = await renderHook({
        ...baseOptions,
        select: (data: Data) => {
          if (!data.addTag) {
            throw new Error('Tag was not added');
          }
          return data.addTag;
        },
      });

      await act(async () => {
        await current().execute({ tagName: 'travel' });
      });

      expect(toastMock.success).not.toHaveBeenCalled();
      expect(toastMock.error).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('lets `errorDescription` surface the thrown message', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      useMutationMock.mockReturnValue([{ fetching: false }, resolveWith({ addTag: false })]);

      const { current } = await renderHook({
        ...baseOptions,
        select: (): boolean => {
          throw new Error('Tag already exists');
        },
        errorDescription: (e: unknown) => (e instanceof Error ? e.message : 'Error adding tag'),
        errorToast: { duration: 10_000 },
      });

      await act(async () => {
        await current().execute({ tagName: 'travel' });
      });

      expect(toastMock.error).toHaveBeenCalledWith('Error', {
        description: 'Tag already exists',
        duration: 10_000,
        closeButton: true,
        id: 'addTag',
      });
      consoleError.mockRestore();
    });

    it('stays quiet when the response carried an error `handleCommonErrors` already reported', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      useMutationMock.mockReturnValue([
        { fetching: false },
        vi.fn().mockResolvedValue({ error: { graphQLErrors: [] } }),
      ]);

      const { current } = await renderHook({ ...baseOptions, select: (data: Data) => data.addTag });

      let result: boolean | void = true;
      await act(async () => {
        result = await current().execute({ tagName: 'travel' });
      });

      expect(result).toBeUndefined();
      expect(toastMock.success).not.toHaveBeenCalled();
      // `handleCommonErrors` raised the toast; the hook must not add a second one.
      expect(toastMock.error).toHaveBeenCalledTimes(1);
      consoleError.mockRestore();
    });
  });

  it('keeps `execute` referentially stable across renders', async () => {
    const mutate = resolveWith({ addTag: true });
    useMutationMock.mockReturnValue([{ fetching: false }, mutate]);

    const { renders, current, rerender } = await renderHook({
      ...baseOptions,
      // A fresh closure on every render — `execute` must not change identity because of it.
      successToast: () => ({ description: 'Tag added' }),
    });

    await rerender();

    expect(renders.length).toBeGreaterThan(1);
    expect(current().execute).toBe(renders[0]!.execute);
  });

  it('runs the latest options even though `execute` is stable', async () => {
    useMutationMock.mockReturnValue([{ fetching: false }, resolveWith({ addTag: true })]);
    const first = vi.fn().mockReturnValue({ description: 'first' });

    const options: UseApiMutationOptions<Data, Variables, undefined, unknown> = {
      ...baseOptions,
      successToast: first,
    };

    const container = document.createElement('div');
    document.body.append(container);
    let latest: UseApiMutation<Variables, unknown> | null = null;

    function Harness({
      hookOptions,
    }: {
      hookOptions: UseApiMutationOptions<Data, Variables, undefined, unknown>;
    }): null {
      latest = useApiMutation(hookOptions);
      return null;
    }

    let root: Root | null = null;
    await act(async () => {
      root = createRoot(container);
      root.render(React.createElement(Harness, { hookOptions: options }));
    });

    const second = vi.fn().mockReturnValue({ description: 'second' });
    await act(async () => {
      root?.render(
        React.createElement(Harness, { hookOptions: { ...options, successToast: second } }),
      );
    });

    await act(async () => {
      await latest!.execute({ tagName: 'travel' });
    });

    expect(first).not.toHaveBeenCalled();
    expect(toastMock.success).toHaveBeenCalledWith('Success', {
      description: 'second',
      id: 'addTag',
    });
  });
});
