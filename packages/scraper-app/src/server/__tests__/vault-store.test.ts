import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultVault, encryptVault, type Vault } from '../vault.js';
import {
  closeVault,
  createVault,
  exportVault,
  getChanges,
  getSessionInfo,
  getVault,
  isLocked,
  markSaved,
  openVault,
  updateVault,
} from '../vault-store.js';

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    writeFile: vi.fn(() => {
      throw new Error('vault-store must not write files');
    }),
  };
});

const PASSWORD = 'test-password-123';

function seeded(): Vault {
  const vault = defaultVault();
  vault.maxAccounts.push({ id: 'max-1', nickname: 'Personal', username: 'u', password: 'p' });
  vault.accountRecords.push({
    id: 'rec-1',
    sourceId: 'max-1',
    sourceType: 'max',
    accountNumber: '1234',
    status: 'pending',
  });
  return vault;
}

async function openSeeded() {
  return openVault(await encryptVault(seeded(), PASSWORD), PASSWORD, 'mine.vault');
}

describe('vault-store', () => {
  afterEach(() => closeVault());

  it('opens a vault from its file contents', async () => {
    expect(await openSeeded()).toBe('ok');
    expect(isLocked()).toBe(false);
    expect(getVault().maxAccounts[0]?.nickname).toBe('Personal');
    expect(getSessionInfo()).toEqual({ origin: 'opened', fileName: 'mine.vault' });
    expect(getChanges()).toEqual({ dirty: false, neverSaved: false, items: [] });
  });

  it('rejects a wrong password and leaves the store locked', async () => {
    const blob = await encryptVault(seeded(), PASSWORD);
    expect(await openVault(blob, 'nope', 'mine.vault')).toBe('wrong-password');
    expect(isLocked()).toBe(true);
  });

  it('rejects contents that are not a vault file', async () => {
    expect(await openVault('not a vault', PASSWORD, 'x.txt')).toBe('invalid-file');
    expect(await openVault('aGVsbG8=', PASSWORD, 'x.txt')).toBe('invalid-file');
  });

  it('creates a new vault that has never been saved', () => {
    createVault(PASSWORD, 'http://x/graphql', 'key');
    expect(getSessionInfo().origin).toBe('new');
    const changes = getChanges();
    expect(changes).toMatchObject({ dirty: true, neverSaved: true });
  });

  it('updateVault changes memory only', async () => {
    await openSeeded();
    await updateVault(v => ({ ...v, settings: { ...v.settings, showBrowser: true } }));
    expect(getVault().settings.showBrowser).toBe(true);
  });

  it('throws when used while locked', async () => {
    expect(() => getVault()).toThrow('Vault is locked');
    await expect(updateVault(v => v)).rejects.toThrow('Vault is locked');
  });

  describe('getChanges', () => {
    it('reports edited and removed sources and accounts', async () => {
      await openSeeded();
      await updateVault(v => ({
        ...v,
        maxAccounts: [{ ...v.maxAccounts[0]!, password: 'changed' }],
        accountRecords: [],
      }));
      expect(getChanges().items).toEqual([
        { section: 'sources', kind: 'edited', id: 'max-1', sourceType: 'max', label: 'Personal' },
        { section: 'accounts', kind: 'removed', id: 'rec-1', sourceType: 'max', label: '1234' },
      ]);
    });

    it('reports discovered accounts with branch-prefixed labels', async () => {
      await openSeeded();
      await updateVault(v => ({
        ...v,
        accountRecords: [
          ...v.accountRecords,
          {
            id: 'rec-2',
            sourceId: 'p-1',
            sourceType: 'poalim',
            accountNumber: '555',
            branchNumber: '700',
            status: 'pending',
          },
        ],
      }));
      expect(getChanges().items).toEqual([
        { section: 'accounts', kind: 'added', id: 'rec-2', sourceType: 'poalim', label: '700-555' },
      ]);
    });

    it('is not fooled by a no-op update', async () => {
      await openSeeded();
      await updateVault(v => ({ ...v, settings: { ...v.settings } }));
      expect(getChanges().dirty).toBe(false);
    });
  });

  describe('export and save', () => {
    it('only clears the dirty state once the save is confirmed', async () => {
      await openSeeded();
      await updateVault(v => ({ ...v, settings: { ...v.settings, showBrowser: true } }));
      const { revision } = await exportVault();
      expect(getChanges().dirty).toBe(true);
      expect(markSaved(revision)).toBe(true);
      expect(getChanges().dirty).toBe(false);
    });

    it('a new vault stops being "never saved" after its first save', async () => {
      createVault(PASSWORD, '', '');
      const { revision } = await exportVault();
      markSaved(revision, 'picked-name.vault');
      expect(getChanges()).toEqual({ dirty: false, neverSaved: false, items: [] });
      expect(getSessionInfo().fileName).toBe('picked-name.vault');
    });

    it('ignores a confirmation for anything but the latest export', async () => {
      await openSeeded();
      const first = await exportVault();
      await updateVault(v => ({ ...v, settings: { ...v.settings, showBrowser: true } }));
      await exportVault();
      expect(markSaved(first.revision)).toBe(false);
    });
  });
});
