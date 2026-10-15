import { randomUUID } from 'node:crypto';
import type { VaultChangeItem, VaultChanges } from '../shared/types.js';
import { decryptVault, defaultVault, encryptVault, type Vault } from './vault.js';

// The vault lives only in memory for the lifetime of the session. It is never written to disk:
// the user opens their own vault file (or creates a new one) and saves it back through the UI.

type Session = {
  /** Identifies this session, so a browser tab can't save one vault over another vault's file. */
  id: string;
  vault: Vault;
  password: string;
  origin: 'new' | 'opened';
  fileName: string;
  /** Bumped on every update, so an export can be tied to the exact state it captured. */
  revision: number;
  /** Canonical JSON of the vault as it is in the user's file; null until a new vault is saved. */
  baseline: string | null;
  /** Recent exports by revision; whichever the client confirms writing last becomes the baseline. */
  exports: Map<number, string>;
};

/** Saves are acknowledged within seconds, so only a handful of exports are ever outstanding. */
const MAX_PENDING_EXPORTS = 20;

let _session: Session | null = null;

const DEFAULT_FILE_NAME = 'accounter.vault';

/** JSON with sorted object keys, so key order never makes two equal vaults look different. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    return v;
  });
}

export async function openVault(
  blob: string,
  password: string,
  fileName: string,
): Promise<'ok' | 'wrong-password' | 'invalid-file' | 'already-open'> {
  const trimmed = blob.trim();
  // Header (6) + salt (32) + iv (12) + tag (16) — anything shorter is not a vault file.
  if (!/^[A-Za-z0-9+/]+=*$/.test(trimmed) || Buffer.from(trimmed, 'base64').length < 66) {
    return 'invalid-file';
  }
  const vault = await decryptVault(trimmed, password);
  if (vault === null) return 'wrong-password';
  // Checked after the (async) decryption, right before assigning, so two overlapping opens can't
  // both pass. Replacing a session would silently drop its unsaved changes.
  if (_session !== null) return 'already-open';
  _session = {
    id: randomUUID(),
    vault,
    password,
    origin: 'opened',
    fileName: fileName || DEFAULT_FILE_NAME,
    revision: 0,
    baseline: canonical(vault),
    exports: new Map(),
  };
  return 'ok';
}

/** Returns false when a session is already open. */
export function createVault(password: string, serverUrl: string, apiKey: string): boolean {
  if (_session !== null) return false;
  const vault = defaultVault();
  if (serverUrl) vault.settings.serverUrl = serverUrl;
  if (apiKey) vault.settings.apiKey = apiKey;
  _session = {
    id: randomUUID(),
    vault,
    password,
    origin: 'new',
    fileName: DEFAULT_FILE_NAME,
    revision: 0,
    baseline: null,
    exports: new Map(),
  };
  return true;
}

function session(): Session {
  if (_session === null) throw new Error('Vault is locked');
  return _session;
}

export function getVault(): Vault {
  return session().vault;
}

export async function updateVault(fn: (v: Vault) => Vault): Promise<void> {
  const s = session();
  s.vault = fn(s.vault);
  s.revision += 1;
}

export function isLocked(): boolean {
  return _session === null;
}

export function closeVault(): void {
  _session = null;
}

export function getSessionInfo(): {
  sessionId: string;
  origin: 'new' | 'opened';
  fileName: string;
} {
  const { id, origin, fileName } = session();
  return { sessionId: id, origin, fileName };
}

/** Whether `sessionId` names the session that is open right now. */
export function isCurrentSession(sessionId: string): boolean {
  return _session !== null && _session.id === sessionId;
}

/** Encrypts the current vault for the client to write to a file. */
export async function exportVault(): Promise<{
  blob: string;
  revision: number;
  fileName: string;
}> {
  const s = session();
  const json = canonical(s.vault);
  const revision = s.revision;
  const blob = await encryptVault(s.vault, s.password);
  s.exports.delete(revision);
  s.exports.set(revision, json);
  while (s.exports.size > MAX_PENDING_EXPORTS) {
    s.exports.delete(s.exports.keys().next().value!);
  }
  return { blob, revision, fileName: s.fileName };
}

/**
 * Called once the client has written an exported blob to a file. Only then does that export
 * become the new baseline — a cancelled save dialog leaves the session dirty.
 *
 * The baseline follows the most recent acknowledgement, even one for an older revision: the
 * write acknowledged last is the one now in the file, so it is what the file holds.
 */
export function markSaved(revision: number, fileName?: string): boolean {
  const s = session();
  const json = s.exports.get(revision);
  if (json === undefined) return false;
  s.baseline = json;
  if (fileName) s.fileName = fileName;
  return true;
}

// ── Change tracking ──────────────────────────────────────────────────────────

const SOURCE_ARRAYS = {
  poalimAccounts: 'poalim',
  discountAccounts: 'discount',
  isracardAccounts: 'isracard',
  amexAccounts: 'amex',
  calAccounts: 'cal',
  maxAccounts: 'max',
  otsarHahayalAccounts: 'otsar-hahayal',
} as const satisfies Partial<Record<keyof Vault, string>>;

type Identified = { id: string };

function diffById<T extends Identified>(
  before: T[],
  after: T[],
  toItem: (item: T, kind: VaultChangeItem['kind']) => VaultChangeItem,
): VaultChangeItem[] {
  const items: VaultChangeItem[] = [];
  const prevById = new Map(before.map(x => [x.id, x]));
  const nextIds = new Set(after.map(x => x.id));
  for (const item of after) {
    const prev = prevById.get(item.id);
    if (prev === undefined) items.push(toItem(item, 'added'));
    else if (canonical(prev) !== canonical(item)) items.push(toItem(item, 'edited'));
  }
  for (const prev of before) {
    if (!nextIds.has(prev.id)) items.push(toItem(prev, 'removed'));
  }
  return items;
}

function computeChangeItems(before: Vault, after: Vault): VaultChangeItem[] {
  const items: VaultChangeItem[] = [];

  for (const [key, sourceType] of Object.entries(SOURCE_ARRAYS) as [
    keyof typeof SOURCE_ARRAYS,
    string,
  ][]) {
    const prev = before[key] as (Identified & { nickname?: string })[];
    const next = after[key] as (Identified & { nickname?: string })[];
    items.push(
      ...diffById(prev, next, (src, kind) => ({
        section: 'sources',
        kind,
        id: src.id,
        sourceType,
        label: src.nickname || src.id.slice(0, 6),
      })),
    );
  }

  items.push(
    ...diffById(before.accountRecords, after.accountRecords, (rec, kind) => ({
      section: 'accounts',
      kind,
      id: rec.id,
      sourceType: rec.sourceType,
      label: rec.branchNumber ? `${rec.branchNumber}-${rec.accountNumber}` : rec.accountNumber,
    })),
  );

  const settingKeys = new Set([...Object.keys(before.settings), ...Object.keys(after.settings)]);
  for (const key of [...settingKeys].sort()) {
    const prev = (before.settings as Record<string, unknown>)[key];
    const next = (after.settings as Record<string, unknown>)[key];
    if (canonical(prev) === canonical(next)) continue;
    items.push({
      section: 'settings',
      kind: prev === undefined ? 'added' : next === undefined ? 'removed' : 'edited',
      id: key,
      label: key,
    });
  }

  return items;
}

export function getChanges(): VaultChanges {
  const s = session();
  if (s.baseline === null) {
    return {
      dirty: true,
      neverSaved: true,
      items: computeChangeItems(defaultVault(), s.vault),
    };
  }
  const current = canonical(s.vault);
  if (current === s.baseline) return { dirty: false, neverSaved: false, items: [] };
  const before = JSON.parse(s.baseline) as Vault;
  return { dirty: true, neverSaved: false, items: computeChangeItems(before, s.vault) };
}
