import { access } from 'node:fs/promises';
import { loadVaultFile, saveVaultFile, type Vault } from './vault.js';

function getVaultPath(): string {
  return process.env['VAULT_FILE'] ?? '.vault';
}

let _vault: Vault | null = null;
let _password: string | null = null;

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
  return 'ok';
}

export function getVault(): Vault {
  if (_vault === null) throw new Error('Vault is locked');
  return _vault;
}

export async function updateVault(fn: (v: Vault) => Vault): Promise<void> {
  if (_vault === null || _password === null) throw new Error('Vault is locked');
  _vault = fn(_vault);
  await saveVaultFile(getVaultPath(), _vault, _password);
}

export function isLocked(): boolean {
  return _vault === null;
}

export function lockVault(): void {
  _vault = null;
  _password = null;
}
