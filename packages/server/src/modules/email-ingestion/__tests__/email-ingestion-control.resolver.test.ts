import { describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import { GraphQLError } from 'graphql';
import { emailIngestionControlResolver } from '../resolvers/email-ingestion-control.resolver.js';
import { EmailIngestionControlProvider } from '../providers/email-ingestion-control.provider.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const GRANT_TTL_MS = 5 * 60 * 1000; // 5 minutes

const baseInput = {
  recipientAlias: 'invoice@tenant.example.com',
  messageId: 'msg-abc-123',
  rawMessageHash: 'sha256-abc',
  receivedAt: new Date().toISOString(),
  correlationId: 'corr-xyz-001',
};

const mockGrant = {
  jti: 'jti-uuid',
  tenantId: 'tenant-uuid-1',
  messageId: 'msg-abc-123',
  rawMessageHash: 'sha256-abc',
  action: 'ingest',
  expiresAt: new Date(Date.now() + GRANT_TTL_MS),
  decisionId: 'decision-uuid',
  auditId: 'audit-uuid',
};

function makeInjector(overrides: Partial<EmailIngestionControlProvider> = {}): Injector {
  const controlProvider: Partial<EmailIngestionControlProvider> = {
    resolveAlias: vi.fn().mockResolvedValue({ found: true, tenantId: 'tenant-uuid-1' }),
    recognizeBusinessFromEvidence: vi.fn().mockResolvedValue({ businessId: null, config: {} }),
    issueGrant: vi.fn().mockResolvedValue(mockGrant),
    ...overrides,
  };

  return {
    get: <T>(token: unknown): T => {
      if (token === EmailIngestionControlProvider) return controlProvider as unknown as T;
      throw new Error(`Unexpected provider: ${String(token)}`);
    },
  } as unknown as Injector;
}

// ---------------------------------------------------------------------------
// Mutation.requestIngestControl resolver
// ---------------------------------------------------------------------------

describe('Mutation.requestIngestControl', () => {
  const resolver = emailIngestionControlResolver.Mutation!.requestIngestControl!;

  it('resolves alias and returns IngestControlDecision on success', async () => {
    const injector = makeInjector();
    const result = await resolver(
      {} as never,
      { input: baseInput },
      { injector } as never,
      {} as never,
    );

    expect(result).toMatchObject({
      tenantId: 'tenant-uuid-1',
      decisionId: 'decision-uuid',
      auditId: 'audit-uuid',
      grant: expect.objectContaining({
        jti: 'jti-uuid',
        tenantId: 'tenant-uuid-1',
        action: 'ingest',
      }),
    });
  });

  it('calls resolveAlias with the recipientAlias from input', async () => {
    const resolveAlias = vi.fn().mockResolvedValue({ found: true, tenantId: 'tenant-uuid-1' });
    const injector = makeInjector({ resolveAlias, issueGrant: vi.fn().mockResolvedValue(mockGrant) });

    await resolver(
      {} as never,
      { input: { ...baseInput, recipientAlias: 'test@example.com' } },
      { injector } as never,
      {} as never,
    );

    expect(resolveAlias).toHaveBeenCalledWith('test@example.com');
  });

  it('returns CommonError when alias is unknown', async () => {
    const injector = makeInjector({
      resolveAlias: vi.fn().mockResolvedValue({ found: false, reason: 'UNKNOWN_ALIAS' }),
    });

    const result = await resolver(
      {} as never,
      { input: baseInput },
      { injector } as never,
      {} as never,
    );

    expect(result).toMatchObject({
      __typename: 'CommonError',
      message: expect.stringContaining('UNKNOWN_ALIAS'),
    });
  });

  it('does not call issueGrant when alias resolution fails', async () => {
    const issueGrant = vi.fn();
    const injector = makeInjector({
      resolveAlias: vi.fn().mockResolvedValue({ found: false, reason: 'UNKNOWN_ALIAS' }),
      issueGrant,
    });

    await resolver(
      {} as never,
      { input: baseInput },
      { injector } as never,
      {} as never,
    );

    expect(issueGrant).not.toHaveBeenCalled();
  });

  it('throws GraphQLError on unexpected provider failure', async () => {
    const injector = makeInjector({
      resolveAlias: vi.fn().mockRejectedValue(new Error('DB down')),
    });

    await expect(
      resolver({} as never, { input: baseInput }, { injector } as never, {} as never),
    ).rejects.toThrow(GraphQLError);
  });

  it('passes correlationId and messageId to issueGrant', async () => {
    const issueGrant = vi.fn().mockResolvedValue(mockGrant);
    const injector = makeInjector({ issueGrant });

    await resolver(
      {} as never,
      { input: { ...baseInput, correlationId: 'corr-999' } },
      { injector } as never,
      {} as never,
    );

    const callArg = issueGrant.mock.calls[0][0];
    expect(callArg.correlationId).toBe('corr-999');
    expect(callArg.messageId).toBe(baseInput.messageId);
  });

  it('recognizes the issuer from senderEvidence and returns the business config', async () => {
    const recognizeBusinessFromEvidence = vi.fn().mockResolvedValue({
      businessId: 'biz-1',
      config: {
        emailBody: true,
        attachments: ['PDF'],
        internalEmailLinks: ['https://acme.com/inv'],
      },
    });
    const injector = makeInjector({ recognizeBusinessFromEvidence });

    const result = await resolver(
      {} as never,
      { input: { ...baseInput, senderEvidence: { from: 'vendor@acme.com' } } },
      { injector } as never,
      {} as never,
    );

    expect(recognizeBusinessFromEvidence).toHaveBeenCalledWith('tenant-uuid-1', {
      from: 'vendor@acme.com',
    });
    expect(result).toMatchObject({
      businessEmailConfig: {
        businessId: 'biz-1',
        emailBody: true,
        attachments: ['PDF'],
        internalEmailLinks: ['https://acme.com/inv'],
      },
    });
  });

  it('returns null businessEmailConfig when no business is recognized', async () => {
    const injector = makeInjector();
    const result = await resolver(
      {} as never,
      { input: baseInput },
      { injector } as never,
      {} as never,
    );

    expect((result as { businessEmailConfig: unknown }).businessEmailConfig).toBeNull();
  });

  it('binds the recognized businessId into the issued grant', async () => {
    const issueGrant = vi.fn().mockResolvedValue(mockGrant);
    const recognizeBusinessFromEvidence = vi
      .fn()
      .mockResolvedValue({ businessId: 'biz-7', config: {} });
    const injector = makeInjector({ issueGrant, recognizeBusinessFromEvidence });

    await resolver(
      {} as never,
      { input: { ...baseInput, senderEvidence: { from: 'vendor@acme.com' } } },
      { injector } as never,
      {} as never,
    );

    expect(issueGrant.mock.calls[0][0].businessId).toBe('biz-7');
  });
});
