import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useReprocessDocumentOcr } from '../use-reprocess-document-ocr.js';

const { toastMock, useMutationMock } = vi.hoisted(() => ({
  toastMock: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
  useMutationMock: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: toastMock }));
vi.mock('urql', async importOriginal => ({
  ...(await importOriginal<typeof import('urql')>()),
  useMutation: useMutationMock,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type Hook = ReturnType<typeof useReprocessDocumentOcr>;

/** Renders the hook with `mutate` behind both of its `useMutation` calls. */
async function renderHook(mutate: ReturnType<typeof vi.fn>): Promise<() => Hook> {
  useMutationMock.mockReturnValue([{ fetching: false }, mutate]);
  let latest: Hook | null = null;
  function Harness(): null {
    latest = useReprocessDocumentOcr();
    return null;
  }
  const container = document.createElement('div');
  document.body.append(container);
  await act(async () => {
    createRoot(container).render(React.createElement(Harness));
  });
  return () => latest!;
}

const success = (documentId: string) => ({
  __typename: 'ReprocessDocumentOcrSuccessfulResult' as const,
  updatedFields: ['date'],
  document: { id: documentId },
});
const failure = { __typename: 'CommonError' as const, message: 'No file' };

// The guard is module-level and keyed by variables, so every test uses its own document ids.
describe('useReprocessDocumentOcr dedupe', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('runs OCR once for a repeated single-document call', async () => {
    const mutate = vi.fn().mockResolvedValue({ data: { reprocessDocumentOcr: success('doc-1') } });
    const hook = await renderHook(mutate);

    await act(async () => {
      await hook().reprocessDocumentOcr('doc-1');
      await hook().reprocessDocumentOcr('doc-1');
    });

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(toastMock.warning).toHaveBeenCalledWith(
      'Duplicate request blocked',
      expect.objectContaining({ id: 'reprocessDocumentOcr-doc-1-duplicate' }),
    );
  });

  it('lifts the guard when the resolver returns a `CommonError`', async () => {
    const mutate = vi.fn().mockResolvedValue({ data: { reprocessDocumentOcr: failure } });
    const hook = await renderHook(mutate);

    await act(async () => {
      await hook().reprocessDocumentOcr('doc-2');
      await hook().reprocessDocumentOcr('doc-2');
    });

    expect(mutate).toHaveBeenCalledTimes(2);
  });

  it('keeps the guard after a partly failed batch', async () => {
    const mutate = vi.fn().mockResolvedValue({
      data: { batchReprocessDocumentsOcr: [success('doc-3'), failure] },
    });
    const hook = await renderHook(mutate);

    await act(async () => {
      await hook().batchReprocessDocumentsOcr(['doc-3', 'doc-4']);
      await hook().batchReprocessDocumentsOcr(['doc-3', 'doc-4']);
    });

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('lifts the guard when every document in the batch failed', async () => {
    const mutate = vi.fn().mockResolvedValue({
      data: { batchReprocessDocumentsOcr: [failure, failure] },
    });
    const hook = await renderHook(mutate);

    await act(async () => {
      await hook().batchReprocessDocumentsOcr(['doc-5', 'doc-6']);
      await hook().batchReprocessDocumentsOcr(['doc-5', 'doc-6']);
    });

    expect(mutate).toHaveBeenCalledTimes(2);
  });
});
