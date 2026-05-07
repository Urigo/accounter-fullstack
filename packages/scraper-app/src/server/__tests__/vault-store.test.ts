import { randomBytes } from 'node:crypto';
import { access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultVault, saveVaultFile } from '../vault.js';
import { getCurrentVaultPath, lockVault, moveVaultFile, unlockVault } from '../vault-store.js';

const PASSWORD = 'test-password-123';

function makeTmpPath() {
  return join(tmpdir(), `vault-store-test-${randomBytes(4).toString('hex')}.vault`);
}

describe('vault-store', () => {
  let vaultPath: string;

  beforeEach(async () => {
    vaultPath = makeTmpPath();
    await saveVaultFile(vaultPath, defaultVault(), PASSWORD);
  });

  afterEach(async () => {
    lockVault();
    await rm(vaultPath, { force: true });
    delete process.env['VAULT_PATH'];
  });

  it('getCurrentVaultPath returns env default before unlock', () => {
    delete process.env['VAULT_PATH'];
    expect(getCurrentVaultPath()).toBe('.vault');
  });

  it('getCurrentVaultPath returns the path set at unlock', async () => {
    process.env['VAULT_PATH'] = vaultPath;
    await unlockVault(PASSWORD);
    expect(getCurrentVaultPath()).toBe(vaultPath);
  });

  it('moveVaultFile moves the file and updates getCurrentVaultPath', async () => {
    process.env['VAULT_PATH'] = vaultPath;
    await unlockVault(PASSWORD);
    const newPath = makeTmpPath();
    try {
      await moveVaultFile(newPath);
      expect(getCurrentVaultPath()).toBe(newPath);
      const exists = await access(newPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    } finally {
      await rm(newPath, { force: true });
    }
  });

  it('moveVaultFile is a no-op when paths are the same', async () => {
    process.env['VAULT_PATH'] = vaultPath;
    await unlockVault(PASSWORD);
    await expect(moveVaultFile(vaultPath)).resolves.not.toThrow();
  });

  it('moveVaultFile throws when vault is locked', async () => {
    await expect(moveVaultFile('/some/path')).rejects.toThrow('Vault is locked');
  });
});
