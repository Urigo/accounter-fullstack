// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { VaultUnlock } from '../screens/vault-unlock.js';
import { makeVaultCtx, WithVault } from './helpers/vault-ctx.js';

const picked = { file: new File(['QUJD'], 'company.vault'), handle: null };

function renderUnlock(ctx = makeVaultCtx({ phase: 'unlocking', picked })) {
  return render(
    <WithVault ctx={ctx}>
      <VaultUnlock />
    </WithVault>,
  );
}

describe('VaultUnlock', () => {
  it('shows the picked file and a password field', () => {
    renderUnlock();
    expect(screen.getByText('company.vault')).toBeTruthy();
    expect(screen.getByLabelText(/master password/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^unlock$/i })).toBeTruthy();
  });

  it('opens the vault with the entered password', async () => {
    const ctx = makeVaultCtx({ phase: 'unlocking', picked });
    renderUnlock(ctx);
    await userEvent.type(screen.getByLabelText(/master password/i), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /^unlock$/i }));
    expect(ctx.open).toHaveBeenCalledWith('secret123');
  });

  it('shows the error under the password field', async () => {
    function Wrapper() {
      const [error, setError] = useState<string | null>(null);
      const ctx = makeVaultCtx({
        phase: 'unlocking',
        picked,
        error,
        open: vi.fn(async () => setError('Wrong password. Please try again.')),
      });
      return (
        <WithVault ctx={ctx}>
          <VaultUnlock />
        </WithVault>
      );
    }
    render(<Wrapper />);
    await userEvent.type(screen.getByLabelText(/master password/i), 'bad');
    await userEvent.click(screen.getByRole('button', { name: /^unlock$/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Wrong password'),
    );
    expect(screen.getByLabelText(/master password/i).getAttribute('aria-invalid')).toBe('true');
  });

  it('can go back to pick a different file', async () => {
    const ctx = makeVaultCtx({ phase: 'unlocking', picked });
    renderUnlock(ctx);
    await userEvent.click(screen.getByRole('button', { name: /change/i }));
    expect(ctx.backToWelcome).toHaveBeenCalled();
  });

  it('does not show an error on first render', () => {
    renderUnlock();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
