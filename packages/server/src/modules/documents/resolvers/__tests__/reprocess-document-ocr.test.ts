import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reprocessDocumentsOcr } from '../../helpers/reprocess-ocr.helper.js';
import { documentsResolvers } from '../documents.resolver.js';

/**
 * The two `reprocessDocumentOcr` mutations are thin over
 * {@link reprocessDocumentsOcr} — the extraction, the fill-only write and the per-document error
 * reporting are the helper's, and are covered by its own tests. What lives only here is the shape
 * of the single-document result and the batch ceiling, which exists because each document costs an
 * OCR round trip the request holds open.
 */

// The resolver module pulls in the Green Invoice client, whose generated mesh artifacts only exist
// after `yarn build:tools`. Nothing on this path touches it, so stub the provider token out rather
// than making this unit test depend on a build step.
vi.mock('../../../app-providers/green-invoice-client.js', () => ({
  GreenInvoiceClientProvider: class GreenInvoiceClientProvider {},
}));

vi.mock('../../helpers/reprocess-ocr.helper.js', () => ({
  MAX_REPROCESS_OCR_BATCH: 20,
  reprocessDocumentsOcr: vi.fn(),
}));

const DOCUMENT_ID = 'dd000000-0000-4000-8000-000000000001';

const injector = {} as unknown as Injector;
const context = { injector } as never;

function callMutation(name: 'reprocessDocumentOcr' | 'batchReprocessDocumentsOcr', args: unknown) {
  const resolver = documentsResolvers.Mutation![name]!;
  const resolve = typeof resolver === 'function' ? resolver : resolver.resolve;
  return (
    resolve as (parent: unknown, args: unknown, context: unknown, info: unknown) => Promise<unknown>
  )({}, args, context, {});
}

beforeEach(() => {
  vi.mocked(reprocessDocumentsOcr).mockReset();
});

describe('Mutation.reprocessDocumentOcr', () => {
  it('unwraps the single positional result', async () => {
    const outcome = { document: { id: DOCUMENT_ID }, updatedFields: ['type'] };
    vi.mocked(reprocessDocumentsOcr).mockResolvedValue([outcome as never]);

    const result = await callMutation('reprocessDocumentOcr', { documentId: DOCUMENT_ID });

    expect(reprocessDocumentsOcr).toHaveBeenCalledWith(injector, [DOCUMENT_ID]);
    expect(result).toBe(outcome);
  });

  it('reports a failed document as a CommonError rather than throwing', async () => {
    const failure = { __typename: 'CommonError' as const, message: 'no stored file' };
    vi.mocked(reprocessDocumentsOcr).mockResolvedValue([failure]);

    await expect(
      callMutation('reprocessDocumentOcr', { documentId: DOCUMENT_ID }),
    ).resolves.toBe(failure);
  });
});

describe('Mutation.batchReprocessDocumentsOcr', () => {
  it('passes the ids through and returns one result per id', async () => {
    const results = [
      { document: { id: 'a' }, updatedFields: ['type'] },
      { __typename: 'CommonError' as const, message: 'b failed' },
    ];
    vi.mocked(reprocessDocumentsOcr).mockResolvedValue(results as never);

    const result = await callMutation('batchReprocessDocumentsOcr', { documentIds: ['a', 'b'] });

    expect(reprocessDocumentsOcr).toHaveBeenCalledWith(injector, ['a', 'b']);
    expect(result).toEqual(results);
  });

  it('refuses a batch larger than the ceiling instead of holding the request open for it', async () => {
    const documentIds = Array.from({ length: 21 }, (_, index) => `doc-${index}`);

    await expect(
      callMutation('batchReprocessDocumentsOcr', { documentIds }),
    ).rejects.toBeInstanceOf(GraphQLError);
    expect(reprocessDocumentsOcr).not.toHaveBeenCalled();
  });
});

describe('ReprocessDocumentOcrResult.__resolveType', () => {
  const resolveType = documentsResolvers.ReprocessDocumentOcrResult!.__resolveType!;

  it('distinguishes a failure from a successful pass', () => {
    const resolve = resolveType as (obj: unknown, context: unknown, info: unknown) => string;
    expect(resolve({ __typename: 'CommonError', message: 'x' }, {}, {})).toBe('CommonError');
    expect(resolve({ document: { id: DOCUMENT_ID }, updatedFields: [] }, {}, {})).toBe(
      'ReprocessDocumentOcrSuccessfulResult',
    );
  });
});
