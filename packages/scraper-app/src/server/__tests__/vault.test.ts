import { describe, expect, it } from 'vitest';
import { decryptVault, defaultVault, encryptVault, VaultSchema } from '../vault.js';

describe('vault', () => {
  it('encrypt→decrypt round-trip returns original vault', async () => {
    const vault = defaultVault();
    vault.poalimAccounts.push({ userCode: 'user1', password: 'pass1' });
    const blob = await encryptVault(vault, 'my-password');
    expect(await decryptVault(blob, 'my-password')).toEqual(vault);
  });

  it('wrong password returns null without throwing', async () => {
    const blob = await encryptVault(defaultVault(), 'correct-password');
    await expect(decryptVault(blob, 'wrong-password')).resolves.toBeNull();
  });

  it('tampered ciphertext returns null', async () => {
    const blob = await encryptVault(defaultVault(), 'password');
    const buf = Buffer.from(blob, 'base64');
    buf[buf.length - 1] ^= 0xff;
    expect(await decryptVault(buf.toString('base64'), 'password')).toBeNull();
  });

  it('VaultSchema rejects missing required fields', () => {
    expect(() =>
      VaultSchema.parse({ poalimAccounts: [{ password: 'no-user-code' }] }),
    ).toThrow();
  });
});
