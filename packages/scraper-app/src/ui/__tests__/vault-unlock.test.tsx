// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { VaultContext } from '../contexts/vault-context.js';
import { VaultUnlock } from '../screens/vault-unlock.js';

function makeCtx(
  unlock: () => Promise<'ok' | 'wrong-password' | 'not-found'> = vi.fn().mockResolvedValue('ok'),
) {
  return {
    locked: true,
    hasFile: true,
    unlock,
    create: vi.fn(),
  };
}

function renderUnlock(ctx = makeCtx()) {
  return render(
    <VaultContext.Provider value={ctx}>
      <VaultUnlock />
    </VaultContext.Provider>,
  );
}

describe('VaultUnlock', () => {
  it('renders the password input and submit button', () => {
    renderUnlock();
    expect(screen.getByLabelText(/master password/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /unlock/i })).toBeTruthy();
  });

  it('calls unlock with the entered password on submit', async () => {
    const unlock = vi.fn().mockResolvedValue('ok');
    renderUnlock(makeCtx(unlock));

    await userEvent.type(screen.getByLabelText(/master password/i), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }));

    expect(unlock).toHaveBeenCalledWith('secret123');
  });

  it('shows an error message when password is wrong', async () => {
    const unlock = vi.fn().mockResolvedValue('wrong-password');
    renderUnlock(makeCtx(unlock));

    await userEvent.type(screen.getByLabelText(/master password/i), 'badpass');
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Wrong password');
    });
  });

  it('does not show an error on initial render', () => {
    renderUnlock();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
