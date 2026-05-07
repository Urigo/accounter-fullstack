import { access, rename } from 'node:fs/promises';
import { getVaultPath, loadVaultFile, saveVaultFile, type Vault } from './vault.js';

let _vault: Vault | null = null;
let _password: string | null = null;
let _vaultPath: string | null = null;

export function getCurrentVaultPath(): string {
  return _vaultPath ?? getVaultPath();
}

export async function hasVaultFile(): Promise<boolean> {
  return access(getVaultPath())
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
  const oldPath = getCurrentVaultPath();
  if (oldPath === newPath) return;
  await rename(oldPath, newPath);
  _vaultPath = newPath;
}
