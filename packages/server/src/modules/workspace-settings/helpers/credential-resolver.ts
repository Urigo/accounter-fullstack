import pg from 'pg';
import { decryptCredentials, hasEncryptionKey } from './crypto.js';

export interface ResolvedCredentials {
  source: 'secure_store' | 'env_fallback';
  credentials: Record<string, string>;
}

const ENV_PROVIDER_MAP: Record<string, () => Record<string, string> | null> = {
  hapoalim: () => {
    const userCode = process.env.USER_CODE;
    const password = process.env.PASSWORD;
    if (!userCode || !password) return null;
    return { userCode, password };
  },
  isracard: () => {
    const id = process.env.ISRACARD_ID;
    const password = process.env.ISRACARD_PASSWORD;
    const last6Digits = process.env.ISRACARD_6_DIGITS;
    if (!id || !password || !last6Digits) return null;
    return { id, password, last6Digits };
  },
  amex: () => {
    const id = process.env.AMEX_ID;
    const password = process.env.AMEX_PASSWORD;
    const last6Digits = process.env.AMEX_6_DIGITS;
    if (!id || !password || !last6Digits) return null;
    return { id, password, last6Digits };
  },
  cal: () => {
    const username = process.env.CAL_USERNAME;
    const password = process.env.CAL_PASSWORD;
    if (!username || !password) return null;
    const result: Record<string, string> = { username, password };
    if (process.env.CAL_LAST4DIGITS) result.last4Digits = process.env.CAL_LAST4DIGITS;
    return result;
  },
  discount: () => {
    const id = process.env.DISCOUNT_ID;
    const password = process.env.DISCOUNT_PASSWORD;
    if (!id || !password) return null;
    const result: Record<string, string> = { id, password };
    if (process.env.DISCOUNT_CODE) result.code = process.env.DISCOUNT_CODE;
    return result;
  },
  max: () => {
    const username = process.env.MAX_USERNAME;
    const password = process.env.MAX_PASSWORD;
    if (!username || !password) return null;
    return { username, password };
  },
  mizrahi: () => {
    const username = process.env.MIZRAHI_USERNAME;
    const password = process.env.MIZRAHI_PASSWORD;
    if (!username || !password) return null;
    return { username, password };
  },
  green_invoice: () => {
    const apiKey = process.env.GREEN_INVOICE_API_KEY;
    const secret = process.env.GREEN_INVOICE_SECRET;
    if (!apiKey || !secret) return null;
    return { apiKey, secret };
  },
};

export async function resolveCredentials(
  ownerId: string,
  provider: string,
  dbPool: pg.Pool,
): Promise<ResolvedCredentials | null> {
  const normalizedProvider = provider.toLowerCase();

  // 1. Try secure store first
  if (hasEncryptionKey()) {
    try {
      const result = await dbPool.query(
        `SELECT credentials_encrypted, credentials_iv, credentials_tag
         FROM accounter_schema.source_connections
         WHERE owner_id = $1 AND provider = $2
           AND credentials_encrypted IS NOT NULL
         LIMIT 1`,
        [ownerId, normalizedProvider],
      );

      if (result.rows[0]) {
        const row = result.rows[0] as {
          credentials_encrypted: Buffer;
          credentials_iv: Buffer;
          credentials_tag: Buffer;
        };
        const plaintext = decryptCredentials(
          row.credentials_encrypted,
          row.credentials_iv,
          row.credentials_tag,
        );
        return {
          source: 'secure_store',
          credentials: JSON.parse(plaintext) as Record<string, string>,
        };
      }
    } catch {
      // Decryption failed or DB error - fall through to env
    }
  }

  // 2. Fallback to env vars
  const envReader = ENV_PROVIDER_MAP[normalizedProvider];
  if (envReader) {
    const envCreds = envReader();
    if (envCreds) {
      return { source: 'env_fallback', credentials: envCreds };
    }
  }

  return null;
}
