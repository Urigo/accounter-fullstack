import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailIngestionControlProvider } from '../providers/email-ingestion-control.provider.js';
import { IngestReasonCode } from '../contracts.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-11T12:00:00.000Z');
const FUTURE = new Date(NOW.getTime() + 5 * 60 * 1000); // +5 min
const PAST = new Date(NOW.getTime() - 1); // 1 ms ago — expired

const baseGrant = {
  id: 'row-uuid',
  jti: 'jti-uuid',
  owner_id: 'tenant-uuid',
  message_id: 'msg-abc-123',
  raw_message_hash: 'sha256-abc',
  action: 'ingest',
  expires_at: FUTURE,
  consumed_at: null as Date | null,
};

const baseInput = {
  jti: 'jti-uuid',
  tenantId: 'tenant-uuid',
  messageId: 'msg-abc-123',
  rawMessageHash: 'sha256-abc',
};

function makeProvider(
  grantRows: typeof baseGrant[] = [baseGrant],
  consumeRows: { id: string }[] = [{ id: 'row-uuid' }],
) {
  const queryFn = vi
    .fn()
    // First call: getGrantByJti
    .mockResolvedValueOnce({ rows: grantRows, rowCount: grantRows.length })
    // Second call: consumeGrantByJti
    .mockResolvedValueOnce({ rows: consumeRows, rowCount: consumeRows.length });

  const pool = { query: queryFn };
  return {
    provider: new EmailIngestionControlProvider({ pool } as never),
    queryFn,
  };
}

// ---------------------------------------------------------------------------
// validateAndConsumeGrant
// ---------------------------------------------------------------------------

describe('EmailIngestionControlProvider.validateAndConsumeGrant', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns valid=true and grant data on successful consume', async () => {
    const { provider } = makeProvider();
    const result = await provider.validateAndConsumeGrant(baseInput);

    expect(result).toMatchObject({
      valid: true,
      grant: expect.objectContaining({ jti: 'jti-uuid', tenantId: 'tenant-uuid', action: 'ingest' }),
    });
  });

  it('returns GRANT_INVALID when jti is not found', async () => {
    const { provider } = makeProvider([], []);
    const result = await provider.validateAndConsumeGrant(baseInput);

    expect(result).toEqual({ valid: false, reason: IngestReasonCode.GRANT_INVALID });
  });

  it('returns GRANT_INVALID when grant is already consumed', async () => {
    const consumed = { ...baseGrant, consumed_at: new Date(NOW.getTime() - 60_000) };
    const { provider } = makeProvider([consumed], []);
    const result = await provider.validateAndConsumeGrant(baseInput);

    expect(result).toEqual({ valid: false, reason: IngestReasonCode.GRANT_INVALID });
  });

  it('returns GRANT_INVALID when grant is expired', async () => {
    const expired = { ...baseGrant, expires_at: PAST };
    const { provider } = makeProvider([expired], []);
    const result = await provider.validateAndConsumeGrant(baseInput);

    expect(result).toEqual({ valid: false, reason: IngestReasonCode.GRANT_INVALID });
  });

  it('returns TENANT_MISMATCH when owner_id does not match tenantId', async () => {
    const { provider } = makeProvider();
    const result = await provider.validateAndConsumeGrant({ ...baseInput, tenantId: 'other-tenant' });

    expect(result).toEqual({ valid: false, reason: IngestReasonCode.TENANT_MISMATCH });
  });

  it('returns GRANT_INVALID when message_id does not match', async () => {
    const { provider } = makeProvider();
    const result = await provider.validateAndConsumeGrant({ ...baseInput, messageId: 'wrong-msg' });

    expect(result).toEqual({ valid: false, reason: IngestReasonCode.GRANT_INVALID });
  });

  it('returns GRANT_INVALID when raw_message_hash does not match', async () => {
    const { provider } = makeProvider();
    const result = await provider.validateAndConsumeGrant({ ...baseInput, rawMessageHash: 'wrong-hash' });

    expect(result).toEqual({ valid: false, reason: IngestReasonCode.GRANT_INVALID });
  });

  it('returns GRANT_INVALID when action is not ingest', async () => {
    const wrongAction = { ...baseGrant, action: 'other' };
    const { provider } = makeProvider([wrongAction], []);
    const result = await provider.validateAndConsumeGrant(baseInput);

    expect(result).toEqual({ valid: false, reason: IngestReasonCode.GRANT_INVALID });
  });

  it('returns GRANT_INVALID when consume UPDATE returns no rows (race condition)', async () => {
    // grant lookup succeeds but consume returns 0 rows (another request consumed it first)
    const { provider } = makeProvider([baseGrant], []);
    const result = await provider.validateAndConsumeGrant(baseInput);

    expect(result).toEqual({ valid: false, reason: IngestReasonCode.GRANT_INVALID });
  });

  it('does not call consume when validation fails', async () => {
    const { provider, queryFn } = makeProvider([], []);
    await provider.validateAndConsumeGrant(baseInput);

    // only one DB call (the lookup) — no consume attempt
    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});
