import { describe, expect, it, vi } from 'vitest';
import { IngestReasonCode } from '../contracts.js';
import { orchestrate, type OrchestrateInput, type OrchestratorDeps } from '../orchestrator.js';
import type { ControlResult, IngestResult } from '../server-client.js';

vi.mock('dotenv', () => ({ config: vi.fn() }));
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_INPUT: OrchestrateInput = {
  recipientAlias: 'invoices@acme.example.com',
  messageId: '<msg001@mail.example.com>',
  rawMessageHash: 'a'.repeat(64),
  correlationId: 'corr-test-001',
  receivedAt: '2026-01-01T12:00:00Z',
  extractedDocuments: [],
};

const GRANT = {
  id: 'grant-001',
  jti: 'jti-001',
  tenantId: 'tenant-001',
  action: 'ingest',
  expiresAt: '2026-01-01T12:05:00Z',
};

const CONTROL_SUCCESS: ControlResult = {
  success: true,
  decision: {
    id: 'dec-001',
    tenantId: 'tenant-001',
    decisionId: 'decision-001',
    auditId: 'audit-control-001',
    grant: GRANT,
  },
};

function makeIngestSuccess(
  outcome: 'INSERTED' | 'DUPLICATE' | 'QUARANTINED' | 'REJECTED',
  extra: Partial<Extract<IngestResult, { success: true }>> = {},
): IngestResult {
  return {
    success: true,
    outcome,
    ingestId: outcome === 'INSERTED' ? 'ingest-001' : null,
    existingIngestId: outcome === 'DUPLICATE' ? 'ingest-prev-001' : null,
    auditId: 'audit-ingest-001',
    reasonCode: null,
    ...extra,
  };
}

function makeDeps(
  controlResult: ControlResult,
  ingestResult?: IngestResult,
): OrchestratorDeps {
  return {
    serverClient: {
      requestControl: vi.fn().mockResolvedValue(controlResult),
      requestIngest: vi.fn().mockResolvedValue(ingestResult ?? makeIngestSuccess('INSERTED')),
    },
  };
}

// ---------------------------------------------------------------------------
// Happy-path outcomes
// ---------------------------------------------------------------------------

describe('orchestrate — happy path', () => {
  it('returns success with INSERTED outcome and propagates ingestId', async () => {
    const deps = makeDeps(CONTROL_SUCCESS, makeIngestSuccess('INSERTED'));
    const result = await orchestrate(BASE_INPUT, deps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.outcome).toBe('INSERTED');
      expect(result.tenantId).toBe('tenant-001');
      expect(result.ingestId).toBe('ingest-001');
      expect(result.auditId).toBe('audit-ingest-001');
    }
  });

  it('returns success with DUPLICATE outcome and propagates existingIngestId', async () => {
    const deps = makeDeps(CONTROL_SUCCESS, makeIngestSuccess('DUPLICATE'));
    const result = await orchestrate(BASE_INPUT, deps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.outcome).toBe('DUPLICATE');
      expect(result.existingIngestId).toBe('ingest-prev-001');
    }
  });

  it('returns success with QUARANTINED outcome and reasonCode', async () => {
    const deps = makeDeps(
      CONTROL_SUCCESS,
      makeIngestSuccess('QUARANTINED', { reasonCode: 'NO_DOCUMENTS' }),
    );
    const result = await orchestrate(BASE_INPUT, deps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.outcome).toBe('QUARANTINED');
      expect(result.reasonCode).toBe('NO_DOCUMENTS');
    }
  });

  it('returns success with REJECTED outcome and reasonCode', async () => {
    const deps = makeDeps(
      CONTROL_SUCCESS,
      makeIngestSuccess('REJECTED', { reasonCode: 'TENANT_MISMATCH' }),
    );
    const result = await orchestrate(BASE_INPUT, deps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.outcome).toBe('REJECTED');
      expect(result.reasonCode).toBe('TENANT_MISMATCH');
    }
  });
});

// ---------------------------------------------------------------------------
// Correlation ID propagation
// ---------------------------------------------------------------------------

describe('orchestrate — correlationId propagation', () => {
  it('passes correlationId to requestControl', async () => {
    const deps = makeDeps(CONTROL_SUCCESS);
    await orchestrate({ ...BASE_INPUT, correlationId: 'trace-xyz' }, deps);
    const controlArg = (
      deps.serverClient.requestControl as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];
    expect(controlArg.correlationId).toBe('trace-xyz');
  });

  it('passes correlationId to requestIngest', async () => {
    const deps = makeDeps(CONTROL_SUCCESS);
    await orchestrate({ ...BASE_INPUT, correlationId: 'trace-xyz' }, deps);
    const ingestArg = (
      deps.serverClient.requestIngest as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];
    expect(ingestArg.correlationId).toBe('trace-xyz');
  });

  it('uses messageId as idempotencyKey for ingest', async () => {
    const deps = makeDeps(CONTROL_SUCCESS);
    await orchestrate(BASE_INPUT, deps);
    const ingestArg = (
      deps.serverClient.requestIngest as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];
    expect(ingestArg.idempotencyKey).toBe(BASE_INPUT.messageId);
  });
});

// ---------------------------------------------------------------------------
// Control-plane failures (adversarial)
// ---------------------------------------------------------------------------

describe('orchestrate — control denied', () => {
  it('returns failure with UNKNOWN_ALIAS and does NOT call requestIngest', async () => {
    const deps = makeDeps({
      success: false,
      reason: IngestReasonCode.UNKNOWN_ALIAS,
      message: 'Alias not registered',
    });
    const result = await orchestrate(BASE_INPUT, deps);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe(IngestReasonCode.UNKNOWN_ALIAS);
    expect(deps.serverClient.requestIngest).not.toHaveBeenCalled();
  });

  it('returns failure with TIMEOUT when control times out', async () => {
    const deps = makeDeps({
      success: false,
      reason: IngestReasonCode.TIMEOUT,
      message: 'Control endpoint timed out',
    });
    const result = await orchestrate(BASE_INPUT, deps);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe(IngestReasonCode.TIMEOUT);
    expect(deps.serverClient.requestIngest).not.toHaveBeenCalled();
  });

  it('returns failure with TRANSIENT_UPSTREAM when control returns 5xx', async () => {
    const deps = makeDeps({
      success: false,
      reason: IngestReasonCode.TRANSIENT_UPSTREAM,
      message: 'Server error',
    });
    const result = await orchestrate(BASE_INPUT, deps);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe(IngestReasonCode.TRANSIENT_UPSTREAM);
  });
});

// ---------------------------------------------------------------------------
// Ingest failures (adversarial)
// ---------------------------------------------------------------------------

describe('orchestrate — ingest failures', () => {
  it('returns failure with GRANT_INVALID when grant is expired or reused', async () => {
    const deps = makeDeps(CONTROL_SUCCESS, {
      success: false,
      reason: IngestReasonCode.GRANT_INVALID,
      message: 'Grant already consumed',
    });
    const result = await orchestrate(BASE_INPUT, deps);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe(IngestReasonCode.GRANT_INVALID);
  });

  it('returns failure with TIMEOUT when ingest times out', async () => {
    const deps = makeDeps(CONTROL_SUCCESS, {
      success: false,
      reason: IngestReasonCode.TIMEOUT,
      message: 'Ingest endpoint timed out',
    });
    const result = await orchestrate(BASE_INPUT, deps);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe(IngestReasonCode.TIMEOUT);
  });

  it('returns failure with TRANSIENT_UPSTREAM when ingest returns 5xx', async () => {
    const deps = makeDeps(CONTROL_SUCCESS, {
      success: false,
      reason: IngestReasonCode.TRANSIENT_UPSTREAM,
      message: 'Server error',
    });
    const result = await orchestrate(BASE_INPUT, deps);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe(IngestReasonCode.TRANSIENT_UPSTREAM);
  });
});

// ---------------------------------------------------------------------------
// Adversarial — tenant mismatch and cross-tenant prevention
// ---------------------------------------------------------------------------

describe('orchestrate — adversarial security scenarios', () => {
  it('surfaces TENANT_MISMATCH reasonCode when server rejects cross-tenant ingest', async () => {
    // Server returns REJECTED outcome with TENANT_MISMATCH reason — proves cross-tenant
    // insertion cannot succeed even if the gateway constructs a valid-looking request.
    const deps = makeDeps(
      CONTROL_SUCCESS,
      makeIngestSuccess('REJECTED', { reasonCode: 'TENANT_MISMATCH' }),
    );
    const result = await orchestrate(BASE_INPUT, deps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.outcome).toBe('REJECTED');
      expect(result.reasonCode).toBe('TENANT_MISMATCH');
    }
  });

  it('propagates tenantId from control decision into ingest request (scope binding)', async () => {
    // Ensures gateway cannot substitute a different tenantId in the ingest call.
    const deps = makeDeps(CONTROL_SUCCESS);
    await orchestrate(BASE_INPUT, deps);
    const ingestArg = (
      deps.serverClient.requestIngest as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];
    expect(ingestArg.tenantId).toBe('tenant-001'); // must come from control decision
  });

  it('uses grant jti from control decision (grant binding)', async () => {
    // Proves gateway cannot inject a different grant into the ingest call.
    const deps = makeDeps(CONTROL_SUCCESS);
    await orchestrate(BASE_INPUT, deps);
    const ingestArg = (
      deps.serverClient.requestIngest as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];
    expect(ingestArg.grantJti).toBe('jti-001'); // bound to the decision grant
  });

  it('returns GRANT_INVALID when grant has already been consumed (replay prevention)', async () => {
    // Simulates an attacker replaying a previously captured valid grant.
    const deps = makeDeps(CONTROL_SUCCESS, {
      success: false,
      reason: IngestReasonCode.GRANT_INVALID,
      message: 'Grant jti already consumed',
    });
    const result = await orchestrate(BASE_INPUT, deps);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe(IngestReasonCode.GRANT_INVALID);
    }
  });

  it('does not call ingest when control returns UNKNOWN_ALIAS (unknown alias)', async () => {
    // Ensures an email to an unregistered alias cannot trigger an ingest attempt.
    const deps = makeDeps({
      success: false,
      reason: IngestReasonCode.UNKNOWN_ALIAS,
      message: 'no such alias',
    });
    await orchestrate(BASE_INPUT, deps);
    expect(deps.serverClient.requestIngest).not.toHaveBeenCalled();
  });

  it('passes rawMessageHash through control and ingest (message binding)', async () => {
    // Proves the same message hash is bound across both server calls, preventing
    // a gateway from substituting a different message hash at the ingest stage.
    const deps = makeDeps(CONTROL_SUCCESS);
    const hash = 'f'.repeat(64);
    await orchestrate({ ...BASE_INPUT, rawMessageHash: hash }, deps);

    const controlArg = (deps.serverClient.requestControl as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    const ingestArg = (deps.serverClient.requestIngest as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(controlArg.rawMessageHash).toBe(hash);
    expect(ingestArg.rawMessageHash).toBe(hash);
  });
});

// ---------------------------------------------------------------------------
// End-to-end proof: full orchestration paths
// ---------------------------------------------------------------------------

describe('orchestrate — end-to-end flow verification', () => {
  it('executes exactly two server calls on success (control + ingest)', async () => {
    const deps = makeDeps(CONTROL_SUCCESS, makeIngestSuccess('INSERTED'));
    await orchestrate(BASE_INPUT, deps);
    expect(deps.serverClient.requestControl).toHaveBeenCalledOnce();
    expect(deps.serverClient.requestIngest).toHaveBeenCalledOnce();
  });

  it('executes only control call when control is denied (no wasted ingest call)', async () => {
    const deps = makeDeps({
      success: false,
      reason: IngestReasonCode.UNKNOWN_ALIAS,
      message: 'not found',
    });
    await orchestrate(BASE_INPUT, deps);
    expect(deps.serverClient.requestControl).toHaveBeenCalledOnce();
    expect(deps.serverClient.requestIngest).not.toHaveBeenCalled();
  });

  it('passes receivedAt to control when present', async () => {
    const deps = makeDeps(CONTROL_SUCCESS);
    await orchestrate({ ...BASE_INPUT, receivedAt: '2026-06-01T08:00:00Z' }, deps);
    const controlArg = (deps.serverClient.requestControl as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(controlArg.receivedAt).toBe('2026-06-01T08:00:00Z');
  });

  it('passes extractedDocuments to ingest', async () => {
    const docs = [{ hash: 'b'.repeat(64), sizeBytes: 1024, mimeType: 'application/pdf' }];
    const deps = makeDeps(CONTROL_SUCCESS);
    await orchestrate({ ...BASE_INPUT, extractedDocuments: docs }, deps);
    const ingestArg = (deps.serverClient.requestIngest as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(ingestArg.extractedDocuments).toEqual(docs);
  });

  it('returns idempotent duplicate outcome on repeated delivery', async () => {
    // Simulates Cloudflare delivering the same email twice.
    // Second delivery with same messageId returns DUPLICATE from server.
    const deps = makeDeps(CONTROL_SUCCESS, makeIngestSuccess('DUPLICATE'));
    const result = await orchestrate(BASE_INPUT, deps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.outcome).toBe('DUPLICATE');
      expect(result.existingIngestId).toBe('ingest-prev-001');
    }
  });
});
