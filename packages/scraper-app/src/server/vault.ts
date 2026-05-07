import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { z, ZodError } from 'zod';

export function getVaultPath(): string {
  return process.env['VAULT_PATH'] ?? '.vault';
}

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN = 32;
const SALT_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;

// Scrypt cost parameters stored in the blob header so decryption is independent
// of whatever the current code constant says (enables future param upgrades).
const SCRYPT_N = 65_536;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
// Node default maxmem is 32 MB; N=65536 r=8 requires ~64 MB. Compute with 2× headroom.
const SCRYPT_MAXMEM = 128 * SCRYPT_N * SCRYPT_R * 2;
// Blob header: N as uint32BE (4 bytes) + r as uint8 (1 byte) + p as uint8 (1 byte)
const HEADER_LEN = 6;

export const PoalimAccountSchema = z.object({
  id: z.string(),
  nickname: z.string().optional(),
  userCode: z.string(),
  password: z.string(),
  options: z
    .object({
      isBusinessAccount: z.boolean().optional(),
      acceptedAccountNumbers: z.array(z.string()).optional(),
      acceptedBranchNumbers: z.array(z.string()).optional(),
      ignoredAccountNumbers: z.array(z.string()).optional(),
      ignoredBranchNumbers: z.array(z.string()).optional(),
    })
    .optional(),
});

export const DiscountAccountSchema = z.object({
  id: z.string(),
  ID: z.string(),
  password: z.string(),
  code: z.string().optional(),
  nickname: z.string().optional(),
});

export const IsracardAmexAccountSchema = z.object({
  id: z.string(),
  nickname: z.string().optional(),
  ownerId: z.string(),
  password: z.string(),
  last6Digits: z.string(),
  options: z
    .object({
      acceptedCardNumbers: z.array(z.string()).optional(),
      ignoredCardNumbers: z.array(z.string()).optional(),
      cardNumberMapping: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

export const CalAccountSchema = z.object({
  id: z.string(),
  nickname: z.string().optional(),
  username: z.string(),
  password: z.string(),
  last4Digits: z.string(),
  options: z
    .object({
      acceptedCardNumbers: z.array(z.string()).optional(),
      ignoredCardNumbers: z.array(z.string()).optional(),
    })
    .optional(),
});

export const MaxAccountSchema = z.object({
  id: z.string(),
  nickname: z.string().optional(),
  username: z.string(),
  password: z.string(),
  options: z
    .object({
      acceptedCardNumbers: z.array(z.string()).optional(),
      ignoredCardNumbers: z.array(z.string()).optional(),
    })
    .optional(),
});

export const SettingsSchema = z.object({
  showBrowser: z.boolean().default(false),
  fetchBankOfIsraelRates: z.boolean().default(true),
  concurrentScraping: z.boolean().default(false),
  defaultDateRangeMonths: z.number().int().positive().default(3),
  historyFilePath: z.string().default('./history.json'),
  saveHistory: z.boolean().default(true),
  serverUrl: z.string().optional(),
  apiKey: z.string().optional(),
  vaultPath: z.string().optional(),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const AccountRecordSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  sourceType: z.enum(['poalim', 'discount', 'isracard', 'amex', 'cal', 'max']),
  accountNumber: z.string(),
  branchNumber: z.string().optional(),
  status: z.enum(['accepted', 'ignored', 'pending']).default('pending'),
});

export type AccountRecord = z.infer<typeof AccountRecordSchema>;

export const VaultSchema = z.object({
  poalimAccounts: z.array(PoalimAccountSchema).default([]),
  discountAccounts: z.array(DiscountAccountSchema).default([]),
  isracardAccounts: z.array(IsracardAmexAccountSchema).default([]),
  amexAccounts: z.array(IsracardAmexAccountSchema).default([]),
  calAccounts: z.array(CalAccountSchema).default([]),
  maxAccounts: z.array(MaxAccountSchema).default([]),
  accountRecords: z.array(AccountRecordSchema).default([]),
  settings: SettingsSchema.default({
    showBrowser: false,
    fetchBankOfIsraelRates: true,
    concurrentScraping: false,
    defaultDateRangeMonths: 3,
    historyFilePath: './history.json',
    saveHistory: true,
  }),
});

export type Vault = z.infer<typeof VaultSchema>;

function deriveKey(
  password: string,
  salt: Buffer,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LEN, options, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

export async function encryptVault(vault: Vault, password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = await deriveKey(password, salt, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(vault), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const header = Buffer.alloc(HEADER_LEN);
  header.writeUInt32BE(SCRYPT_N, 0);
  header.writeUInt8(SCRYPT_R, 4);
  header.writeUInt8(SCRYPT_P, 5);

  // Layout: [N(4)] [r(1)] [p(1)] [salt(32)] [iv(12)] [authTag(16)] [ciphertext]
  return Buffer.concat([header, salt, iv, authTag, encrypted]).toString('base64');
}

export async function decryptVault(blob: string, password: string): Promise<Vault | null> {
  try {
    const buf = Buffer.from(blob, 'base64');
    const N = buf.readUInt32BE(0);
    const r = buf.readUInt8(4);
    const p = buf.readUInt8(5);

    const salt = buf.subarray(HEADER_LEN, HEADER_LEN + SALT_LEN);
    const iv = buf.subarray(HEADER_LEN + SALT_LEN, HEADER_LEN + SALT_LEN + IV_LEN);
    const authTag = buf.subarray(
      HEADER_LEN + SALT_LEN + IV_LEN,
      HEADER_LEN + SALT_LEN + IV_LEN + TAG_LEN,
    );
    const body = buf.subarray(HEADER_LEN + SALT_LEN + IV_LEN + TAG_LEN);

    const key = await deriveKey(password, salt, { N, r, p, maxmem: 128 * N * r * 2 });
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
    return VaultSchema.parse(JSON.parse(plaintext));
  } catch (err) {
    if (err instanceof ZodError) {
      console.error('[vault] schema validation failed after decryption:', err.issues);
    }
    return null;
  }
}

export function defaultVault(): Vault {
  return VaultSchema.parse({ settings: {} });
}

export async function loadVaultFile(filePath: string, password: string): Promise<Vault | null> {
  const blob = await readFile(filePath, 'utf8');
  return decryptVault(blob.trim(), password);
}

export async function saveVaultFile(
  filePath: string,
  vault: Vault,
  password: string,
): Promise<void> {
  const data = await encryptVault(vault, password);
  await writeFile(filePath, data, 'utf8');
}
