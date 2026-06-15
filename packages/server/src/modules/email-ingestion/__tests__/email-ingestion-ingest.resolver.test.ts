import { describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import { emailIngestionIngestResolver } from '../resolvers/email-ingestion-ingest.resolver.js';
import { EmailIngestionIngestProvider } from '../providers/email-ingestion-ingest.provider.js';
import { IngestOutcome, IngestReasonCode } from '../contracts.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const BASE_INPUT = {
  grantJti: 'jti-uuid',
  idempotencyKey: 'idem-key-001',
  tenantId: 'tenant-uuid-a',
  messageId: 'msg-abc-123',
  rawMessageHash: 'sha256-abc',
  correlationId: 'corr-001',
  extractedDocuments: [{ hash: 'doc-hash', sizeBytes: 1024, mimeType: 'application/pdf', filename: 'invoice.pdf' }],
};

function makeInjector(ingestResult: Awaited<ReturnType<EmailIngestionIngestProvider['performIngest']>>): Injector {
  const ingestProvider: Partial<EmailIngestionIngestProvider> = {
    performIngest: vi.fn().mockResolvedValue(ingestResult),
  };

  return {
    get: <T>(token: unknown): T => {
      if (token === EmailIngestionIngestProvider) return ingestProvider as unknown as T;
      throw new Error(`Unexpected provider: ${String(token)}`);
    },
  } as unknown as Injector;
}

// ---------------------------------------------------------------------------
// Mutation.ingestEmail resolver
// ---------------------------------------------------------------------------

describe('Mutation.ingestEmail', () => {
  const resolver = emailIngestionIngestResolver.Mutation!.ingestEmail!;

  it('returns IngestEmailSuccess with INSERTED outcome on happy path', async () => {
    const injector = makeInjector({
      outcome: IngestOutcome.INSERTED,
      ingestId: 'ingest-uuid-1',
      auditId: 'audit-uuid-1',
    });

    const result = await resolver(
      {} as never,
      { input: BASE_INPUT },
      { injector } as never,
      {} as never,
    );

    expect(result).toMatchObject({
      __typename: 'IngestEmailSuccess',
      outcome: 'INSERTED',
      ingestId: 'ingest-uuid-1',
      auditId: 'audit-uuid-1',
    });
  });

  it('returns IngestEmailSuccess with DUPLICATE outcome when idempotency key was seen', async () => {
    const injector = makeInjector({
      outcome: IngestOutcome.DUPLICATE,
      existingIngestId: 'ingest-uuid-prior',
      auditId: 'audit-uuid-prior',
    });

    const result = await resolver(
      {} as never,
      { input: BASE_INPUT },
      { injector } as never,
      {} as never,
    );

    expect(result).toMatchObject({
      __typename: 'IngestEmailSuccess',
      outcome: 'DUPLICATE',
      existingIngestId: 'ingest-uuid-prior',
    });
  });

  it('returns IngestEmailSuccess with DUPLICATE outcome when dedup fingerprint was seen', async () => {
    const injector = makeInjector({
      outcome: IngestOutcome.DUPLICATE,
      existingIngestId: 'ingest-uuid-dedup',
      auditId: 'audit-uuid-dedup',
    });

    const result = await resolver(
      {} as never,
      { input: BASE_INPUT },
      { injector } as never,
      {} as never,
    );

    expect(result).toMatchObject({
      __typename: 'IngestEmailSuccess',
      outcome: 'DUPLICATE',
      existingIngestId: 'ingest-uuid-dedup',
    });
  });

  it('returns IngestEmailSuccess with QUARANTINED outcome when no documents extracted', async () => {
    const injector = makeInjector({
      outcome: IngestOutcome.QUARANTINED,
      auditId: 'audit-uuid-q',
      reasonCode: IngestReasonCode.NO_DOCUMENTS,
    });

    const result = await resolver(
      {} as never,
      { input: { ...BASE_INPUT, extractedDocuments: [] } },
      { injector } as never,
      {} as never,
    );

    expect(result).toMatchObject({
      __typename: 'IngestEmailSuccess',
      outcome: 'QUARANTINED',
      reasonCode: IngestReasonCode.NO_DOCUMENTS,
    });
  });

  it('returns IngestEmailSuccess with REJECTED outcome when grant is invalid', async () => {
    const injector = makeInjector({
      outcome: IngestOutcome.REJECTED,
      reasonCode: IngestReasonCode.GRANT_INVALID,
    });

    const result = await resolver(
      {} as never,
      { input: BASE_INPUT },
      { injector } as never,
      {} as never,
    );

    expect(result).toMatchObject({
      __typename: 'IngestEmailSuccess',
      outcome: 'REJECTED',
      reasonCode: IngestReasonCode.GRANT_INVALID,
    });
  });

  it('returns IngestEmailSuccess with REJECTED outcome on tenant mismatch', async () => {
    const injector = makeInjector({
      outcome: IngestOutcome.REJECTED,
      reasonCode: IngestReasonCode.TENANT_MISMATCH,
    });

    const result = await resolver(
      {} as never,
      { input: BASE_INPUT },
      { injector } as never,
      {} as never,
    );

    expect(result).toMatchObject({
      __typename: 'IngestEmailSuccess',
      outcome: 'REJECTED',
      reasonCode: IngestReasonCode.TENANT_MISMATCH,
    });
  });

  it('returns CommonError on unexpected provider failure', async () => {
    const ingestProvider: Partial<EmailIngestionIngestProvider> = {
      performIngest: vi.fn().mockRejectedValue(new Error('DB connection lost')),
    };
    const injector: Injector = {
      get: <T>(token: unknown): T => {
        if (token === EmailIngestionIngestProvider) return ingestProvider as unknown as T;
        throw new Error(`Unexpected provider: ${String(token)}`);
      },
    } as unknown as Injector;

    const result = await resolver(
      {} as never,
      { input: BASE_INPUT },
      { injector } as never,
      {} as never,
    );

    expect(result).toMatchObject({
      __typename: 'CommonError',
      message: expect.stringContaining('ingest'),
    });
  });

  it('passes all input fields to performIngest', async () => {
    const performIngest = vi.fn().mockResolvedValue({
      outcome: IngestOutcome.INSERTED,
      ingestId: 'x',
      auditId: 'y',
    });
    const injector: Injector = {
      get: <T>(token: unknown): T => {
        if (token === EmailIngestionIngestProvider) return { performIngest } as unknown as T;
        throw new Error(`Unexpected provider: ${String(token)}`);
      },
    } as unknown as Injector;

    await resolver({} as never, { input: BASE_INPUT }, { injector } as never, {} as never);

    expect(performIngest).toHaveBeenCalledWith(
      expect.objectContaining({
        grantJti: 'jti-uuid',
        idempotencyKey: 'idem-key-001',
        tenantId: 'tenant-uuid-a',
        messageId: 'msg-abc-123',
        rawMessageHash: 'sha256-abc',
        correlationId: 'corr-001',
      }),
    );
  });
});
