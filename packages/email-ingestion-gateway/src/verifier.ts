import { createHmac, timingSafeEqual } from 'node:crypto';
import { IngestReasonCode } from './contracts.js';

export interface VerifierConfig {
  /** HMAC-SHA256 shared secret used to validate request signatures */
  webhookSecret: string;
  /** Allowed source IPs or IPv4 CIDR blocks — empty list disables the IP check */
  ipAllowlist: string[];
  /** Maximum age (and future skew) of a request timestamp in seconds (default: 300) */
  timestampToleranceSeconds?: number;
  /** How long to retain seen nonces for replay detection in seconds (default: 600) */
  nonceRetentionSeconds?: number;
  /** Current time provider — injectable for deterministic tests (default: wall clock) */
  currentTimeSeconds?: () => number;
}

export interface AuthenticityInput {
  /** Raw request body bytes */
  rawBody: Buffer | Uint8Array;
  /** Hex-encoded HMAC-SHA256 of `${timestampSeconds}.${rawBody}` */
  signature: string;
  /** Unix timestamp in seconds, extracted from the request header */
  timestampSeconds: number;
  /** Unique per-request nonce for replay detection */
  nonce: string;
  /** Source IP address of the incoming request */
  sourceIp: string;
}

export type AuthenticityVerdict = { valid: true } | { valid: false; reason: IngestReasonCode };

export interface NonceStore {
  /** Stores the nonce and returns true; returns false if already present (replay) */
  checkAndStore(nonce: string, expirySeconds: number): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// In-memory nonce store with TTL eviction
// ---------------------------------------------------------------------------

export class MemoryNonceStore implements NonceStore {
  private readonly seen = new Map<string, number>();
  private readonly clock: () => number;

  constructor(currentTimeSeconds?: () => number) {
    this.clock = currentTimeSeconds ?? (() => Math.floor(Date.now() / 1000));
  }

  async checkAndStore(nonce: string, expirySeconds: number): Promise<boolean> {
    const now = this.clock();
    // Evict expired entries on each call to bound memory usage
    for (const [key, exp] of this.seen) {
      if (exp < now) this.seen.delete(key);
    }
    if (this.seen.has(nonce)) return false;
    this.seen.set(nonce, now + expirySeconds);
    return true;
  }
}

// ---------------------------------------------------------------------------
// Cloudflare authenticity verifier
// ---------------------------------------------------------------------------

export class CloudflareAuthenticityVerifier {
  private readonly secret: string;
  private readonly ipAllowlist: string[];
  private readonly toleranceSeconds: number;
  private readonly retentionSeconds: number;
  private readonly clock: () => number;
  private readonly nonceStore: NonceStore;

  constructor(config: VerifierConfig, nonceStore?: NonceStore) {
    this.secret = config.webhookSecret;
    this.ipAllowlist = config.ipAllowlist;
    this.toleranceSeconds = config.timestampToleranceSeconds ?? 300;
    this.retentionSeconds = config.nonceRetentionSeconds ?? 600;
    this.clock = config.currentTimeSeconds ?? (() => Math.floor(Date.now() / 1000));
    this.nonceStore = nonceStore ?? new MemoryNonceStore(config.currentTimeSeconds);
  }

  async verify(input: AuthenticityInput): Promise<AuthenticityVerdict> {
    // 1. IP allowlist — cheap fail-fast; defense-in-depth, never sole trust signal
    if (this.ipAllowlist.length > 0 && !this.checkIpAllowlist(input.sourceIp)) {
      return { valid: false, reason: IngestReasonCode.INVALID_AUTH };
    }

    // 2. Timestamp window — reject stale or far-future requests
    if (!this.checkTimestampWindow(input.timestampSeconds)) {
      return { valid: false, reason: IngestReasonCode.INVALID_AUTH };
    }

    // 3. HMAC-SHA256 signature — primary authenticity control
    if (!this.verifySignature(input.rawBody, input.timestampSeconds, input.signature)) {
      return { valid: false, reason: IngestReasonCode.INVALID_AUTH };
    }

    // 4. Nonce replay — only reached after signature is verified to prevent store pollution
    if (!(await this.nonceStore.checkAndStore(input.nonce, this.retentionSeconds))) {
      return { valid: false, reason: IngestReasonCode.REPLAY_DETECTED };
    }

    return { valid: true };
  }

  private verifySignature(
    rawBody: Buffer | Uint8Array,
    timestampSeconds: number,
    signature: string,
  ): boolean {
    if (!signature) return false;

    const prefix = Buffer.from(`${timestampSeconds}.`);
    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
    const payload = Buffer.concat([prefix, body]);
    const expected = createHmac('sha256', this.secret).update(payload).digest('hex');

    try {
      const expBuf = Buffer.from(expected, 'hex');
      const gotBuf = Buffer.from(signature, 'hex');
      // timingSafeEqual requires equal lengths; check first to avoid throwing
      if (expBuf.length !== gotBuf.length) return false;
      return timingSafeEqual(expBuf, gotBuf);
    } catch {
      return false;
    }
  }

  private checkIpAllowlist(ip: string): boolean {
    return this.ipAllowlist.some(entry => matchesCidrOrIp(ip, entry));
  }

  private checkTimestampWindow(timestampSeconds: number): boolean {
    return Math.abs(this.clock() - timestampSeconds) <= this.toleranceSeconds;
  }
}

// ---------------------------------------------------------------------------
// IPv4 CIDR / exact-IP matching helpers
// ---------------------------------------------------------------------------

function matchesCidrOrIp(ip: string, entry: string): boolean {
  return entry.includes('/') ? matchesIpv4Cidr(ip, entry) : ip === entry;
}

function matchesIpv4Cidr(ip: string, cidr: string): boolean {
  const slashIdx = cidr.lastIndexOf('/');
  const network = cidr.slice(0, slashIdx);
  const prefixLen = parseInt(cidr.slice(slashIdx + 1), 10);
  if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return false;
  if (prefixLen === 0) return true;

  const ipNum = ipv4ToNumber(ip);
  const networkNum = ipv4ToNumber(network);
  if (ipNum === null || networkNum === null) return false;

  // Zero the host bits using arithmetic to avoid JS 32-bit signed overflow in bitwise ops.
  // For /24: shift=8, factor=256 — dividing and flooring drops the last octet, then multiply restores.
  const factor = 2 ** (32 - prefixLen);
  return Math.floor(ipNum / factor) === Math.floor(networkNum / factor);
}

function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    result = result * 256 + n;
  }
  return result;
}
