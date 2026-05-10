import { constants } from 'node:fs';
import { access, copyFile, mkdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { getVaultPath, loadVaultFile, saveVaultFile, type Vault } from './vault.js';

let _vault: Vault | null = null;
let _password: string | null = null;
let _vaultPath: string | null = null;

export function getCurrentVaultPath(): string {
  return _vaultPath ?? getVaultPath();
}

export async function hasVaultFile(): Promise<boolean> {
  return access(getCurrentVaultPath())
    .then(() => true)
    .catch(() => false);
}

export async function unlockVault(
  password: string,
): Promise<'ok' | 'wrong-password' | 'not-found'> {
  if (!(await hasVaultFile())) return 'not-found';
  const vault = await loadVaultFile(getVaultPath(), password);
  if (vault === null) return 'wrong-password';
  _vault = vault;
  _password = password;
  _vaultPath = getVaultPath();
  return 'ok';
}

export function getVault(): Vault {
  if (_vault === null) throw new Error('Vault is locked');
  return _vault;
}

export async function updateVault(fn: (v: Vault) => Vault): Promise<void> {
  if (_vault === null || _password === null) throw new Error('Vault is locked');
  _vault = fn(_vault);
  await saveVaultFile(getCurrentVaultPath(), _vault, _password);
}

export function isLocked(): boolean {
  return _vault === null;
}

export function lockVault(): void {
  _vault = null;
  _password = null;
  _vaultPath = null;
}

export async function moveVaultFile(newPath: string): Promise<void> {
  if (_vault === null || _password === null) throw new Error('Vault is locked');
  const oldPath = path.resolve(getCurrentVaultPath());
  const normalizedNewPath = path.resolve(newPath);
  if (oldPath === normalizedNewPath) return;
  await mkdir(path.dirname(normalizedNewPath), { recursive: true });
  const destExists = await access(normalizedNewPath)
    .then(() => true)
    .catch(() => false);
  if (destExists) throw new Error('Destination already exists');
  try {
    await rename(oldPath, normalizedNewPath);
  } catch (err) {
    // Fall back to copy+delete for cross-device (EXDEV) moves
    if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err;
    await copyFile(oldPath, normalizedNewPath, constants.COPYFILE_EXCL);
    await unlink(oldPath);
  }
  _vaultPath = normalizedNewPath;
  process.env['VAULT_PATH'] = normalizedNewPath;
}
