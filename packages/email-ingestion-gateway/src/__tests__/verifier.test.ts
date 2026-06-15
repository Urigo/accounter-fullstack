import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IngestReasonCode } from '../contracts.js';
import {
  CloudflareAuthenticityVerifier,
  MemoryNonceStore,
  type AuthenticityInput,
  type VerifierConfig,
} from '../verifier.js';

// Fixed wall-clock value for fully deterministic tests
const FIXED_NOW = 1_700_000_000;

const SECRET = 'test-webhook-secret-32-chars-long';
const ALLOWED_IP = '198.41.128.1';
const RAW_BODY = Buffer.from('{"event":"email","alias":"acme@example.com"}');

function buildSignature(secret: string, timestampSeconds: number, rawBody: Buffer): string {
  const prefix = Buffer.from(`${timestampSeconds}.`);
  return createHmac('sha256', secret).update(Buffer.concat([prefix, rawBody])).digest('hex');
}

function makeConfig(overrides: Partial<VerifierConfig> = {}): VerifierConfig {
  return {
    webhookSecret: SECRET,
    ipAllowlist: [ALLOWED_IP],
    currentTimeSeconds: () => FIXED_NOW,
    ...overrides,
  };
}

function makeInput(overrides: Partial<AuthenticityInput> = {}): AuthenticityInput {
  return {
    rawBody: RAW_BODY,
    signature: buildSignature(SECRET, FIXED_NOW, RAW_BODY),
    timestampSeconds: FIXED_NOW,
    nonce: 'unique-nonce-abc123',
    sourceIp: ALLOWED_IP,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// CloudflareAuthenticityVerifier
// ---------------------------------------------------------------------------

describe('CloudflareAuthenticityVerifier', () => {
  let nonceStore: MemoryNonceStore;
  let verifier: CloudflareAuthenticityVerifier;

  beforeEach(() => {
    nonceStore = new MemoryNonceStore(() => FIXED_NOW);
    verifier = new CloudflareAuthenticityVerifier(makeConfig(), nonceStore);
  });

  it('accepts a fully valid request', async () => {
    expect(await verifier.verify(makeInput())).toEqual({ valid: true });
  });

  // -------------------------------------------------------------------------
  // Signature validation
  // -------------------------------------------------------------------------

  describe('signature validation', () => {
    it('rejects a tampered signature', async () => {
      const result = await verifier.verify(makeInput({ signature: 'deadbeef'.repeat(8) }));
      expect(result).toEqual({ valid: false, reason: IngestReasonCode.INVALID_AUTH });
    });

    it('rejects an empty signature', async () => {
      const result = await verifier.verify(makeInput({ signature: '' }));
      expect(result).toEqual({ valid: false, reason: IngestReasonCode.INVALID_AUTH });
    });

    it('rejects when the body is tampered after signing', async () => {
      const result = await verifier.verify(makeInput({ rawBody: Buffer.from('tampered-body') }));
      expect(result).toEqual({ valid: false, reason: IngestReasonCode.INVALID_AUTH });
    });

    it('rejects a signature computed with the wrong secret', async () => {
      const result = await verifier.verify(
        makeInput({ signature: buildSignature('wrong-secret', FIXED_NOW, RAW_BODY) }),
      );
      expect(result).toEqual({ valid: false, reason: IngestReasonCode.INVALID_AUTH });
    });

    it('rejects a signature with trailing garbage after valid hex (strict length check)', async () => {
      const valid = buildSignature(SECRET, FIXED_NOW, RAW_BODY);
      const result = await verifier.verify(makeInput({ signature: valid + 'zz' }));
      expect(result).toEqual({ valid: false, reason: IngestReasonCode.INVALID_AUTH });
    });

    it('rejects a signature that is valid hex but shorter than 64 chars', async () => {
      const result = await verifier.verify(makeInput({ signature: 'deadbeef' }));
      expect(result).toEqual({ valid: false, reason: IngestReasonCode.INVALID_AUTH });
    });
  });

  // -------------------------------------------------------------------------
  // IP allowlist
  // -------------------------------------------------------------------------

  describe('IP allowlist', () => {
    it('rejects a source IP not in the allowlist', async () => {
      const result = await verifier.verify(makeInput({ sourceIp: '1.2.3.4' }));
      expect(result).toEqual({ valid: false, reason: IngestReasonCode.INVALID_AUTH });
    });

    it('accepts any IP when the allowlist is empty (allowlist disabled)', async () => {
      const openVerifier = new CloudflareAuthenticityVerifier(
        makeConfig({ ipAllowlist: [] }),
        nonceStore,
      );
      const result = await openVerifier.verify(makeInput({ sourceIp: '9.9.9.9' }));
      expect(result).toEqual({ valid: true });
    });

    it('accepts a source IP that matches a CIDR block', async () => {
      const cidrVerifier = new CloudflareAuthenticityVerifier(
        makeConfig({ ipAllowlist: ['198.41.128.0/20'] }),
        nonceStore,
      );
      // 198.41.135.5 is within 198.41.128.0–198.41.143.255
      const result = await cidrVerifier.verify(makeInput({ sourceIp: '198.41.135.5' }));
      expect(result).toEqual({ valid: true });
    });

    it('rejects a source IP outside the CIDR block', async () => {
      const cidrVerifier = new CloudflareAuthenticityVerifier(
        makeConfig({ ipAllowlist: ['198.41.128.0/20'] }),
        nonceStore,
      );
      // 198.41.144.1 is beyond 198.41.143.255
      const result = await cidrVerifier.verify(makeInput({ sourceIp: '198.41.144.1' }));
      expect(result).toEqual({ valid: false, reason: IngestReasonCode.INVALID_AUTH });
    });

    it('accepts a source IP matching one of multiple allowlist entries', async () => {
      const multiVerifier = new CloudflareAuthenticityVerifier(
        makeConfig({ ipAllowlist: ['10.0.0.1', '198.41.128.0/20', '172.16.0.0/12'] }),
        nonceStore,
      );
      // 172.16.5.10 is within 172.16.0.0–172.31.255.255
      const result = await multiVerifier.verify(makeInput({ sourceIp: '172.16.5.10' }));
      expect(result).toEqual({ valid: true });
    });
  });

  // -------------------------------------------------------------------------
  // Timestamp window
  // -------------------------------------------------------------------------

  describe('timestamp window', () => {
    it('rejects a request with a stale timestamp (1 second past tolerance)', async () => {
      const staleTs = FIXED_NOW - 301;
      const result = await verifier.verify(
        makeInput({
          timestampSeconds: staleTs,
          signature: buildSignature(SECRET, staleTs, RAW_BODY),
        }),
      );
      expect(result).toEqual({ valid: false, reason: IngestReasonCode.INVALID_AUTH });
    });

    it('rejects a request with a future timestamp (1 second past tolerance)', async () => {
      const futureTs = FIXED_NOW + 301;
      const result = await verifier.verify(
        makeInput({
          timestampSeconds: futureTs,
          signature: buildSignature(SECRET, futureTs, RAW_BODY),
        }),
      );
      expect(result).toEqual({ valid: false, reason: IngestReasonCode.INVALID_AUTH });
    });

    it('accepts a request exactly at the past tolerance boundary (inclusive)', async () => {
      const boundaryTs = FIXED_NOW - 300;
      const result = await verifier.verify(
        makeInput({
          timestampSeconds: boundaryTs,
          signature: buildSignature(SECRET, boundaryTs, RAW_BODY),
        }),
      );
      expect(result).toEqual({ valid: true });
    });

    it('accepts a request exactly at the future tolerance boundary (inclusive)', async () => {
      const boundaryTs = FIXED_NOW + 300;
      const result = await verifier.verify(
        makeInput({
          timestampSeconds: boundaryTs,
          signature: buildSignature(SECRET, boundaryTs, RAW_BODY),
        }),
      );
      expect(result).toEqual({ valid: true });
    });

    it('respects a custom timestamp tolerance', async () => {
      const strictVerifier = new CloudflareAuthenticityVerifier(
        makeConfig({ timestampToleranceSeconds: 60 }),
        nonceStore,
      );
      const slightlyOldTs = FIXED_NOW - 90;
      const result = await strictVerifier.verify(
        makeInput({
          timestampSeconds: slightlyOldTs,
          signature: buildSignature(SECRET, slightlyOldTs, RAW_BODY),
        }),
      );
      expect(result).toEqual({ valid: false, reason: IngestReasonCode.INVALID_AUTH });
    });
  });

  // -------------------------------------------------------------------------
  // Nonce replay protection
  // -------------------------------------------------------------------------

  describe('nonce replay protection', () => {
    it('rejects a replayed nonce on a second valid request', async () => {
      await verifier.verify(makeInput({ nonce: 'replay-nonce-xyz' }));
      const result = await verifier.verify(makeInput({ nonce: 'replay-nonce-xyz' }));
      expect(result).toEqual({ valid: false, reason: IngestReasonCode.REPLAY_DETECTED });
    });

    it('accepts different nonces on consecutive valid requests', async () => {
      const first = await verifier.verify(makeInput({ nonce: 'nonce-aaa' }));
      const second = await verifier.verify(makeInput({ nonce: 'nonce-bbb' }));
      expect(first).toEqual({ valid: true });
      expect(second).toEqual({ valid: true });
    });

    it('does not consume the nonce when the signature is invalid', async () => {
      // Bad signature → verification fails before touching the nonce store
      await verifier.verify(makeInput({ signature: 'badsig', nonce: 'precious-nonce' }));
      // Same nonce with a valid signature must now succeed (nonce was never stored)
      const result = await verifier.verify(makeInput({ nonce: 'precious-nonce' }));
      expect(result).toEqual({ valid: true });
    });
  });
});

// ---------------------------------------------------------------------------
// MemoryNonceStore
// ---------------------------------------------------------------------------

describe('MemoryNonceStore', () => {
  it('returns true the first time a nonce is stored', async () => {
    const store = new MemoryNonceStore();
    expect(await store.checkAndStore('n1', 300)).toBe(true);
  });

  it('returns false when the same nonce is submitted again', async () => {
    const store = new MemoryNonceStore();
    await store.checkAndStore('n1', 300);
    expect(await store.checkAndStore('n1', 300)).toBe(false);
  });

  it('accepts independent nonces independently', async () => {
    const store = new MemoryNonceStore();
    expect(await store.checkAndStore('n1', 300)).toBe(true);
    expect(await store.checkAndStore('n2', 300)).toBe(true);
    expect(await store.checkAndStore('n3', 300)).toBe(true);
  });

  it('evicts expired nonces and accepts them again', async () => {
    let fakeTime = 1_000_000;
    const store = new MemoryNonceStore(() => fakeTime);
    await store.checkAndStore('n1', 10); // expires at 1_000_010
    fakeTime = 1_000_011; // advance past expiry
    expect(await store.checkAndStore('n1', 300)).toBe(true);
  });

  it('does not evict a nonce before its TTL expires', async () => {
    let fakeTime = 1_000_000;
    const store = new MemoryNonceStore(() => fakeTime);
    await store.checkAndStore('n1', 300); // expires at 1_000_300
    fakeTime = 1_000_299; // 1 second before expiry
    expect(await store.checkAndStore('n1', 300)).toBe(false);
  });

  it('re-accepts a nonce after it expires and is evicted from the queue', async () => {
    let fakeTime = 1_000_000;
    const store = new MemoryNonceStore(() => fakeTime);
    await store.checkAndStore('n1', 10); // expires at 1_000_010
    fakeTime = 1_000_011;
    await store.checkAndStore('n1', 300); // re-accepted; expires at 1_001_311
    fakeTime = 1_000_012;
    // n1 is live again — must be rejected
    expect(await store.checkAndStore('n1', 300)).toBe(false);
  });
});
