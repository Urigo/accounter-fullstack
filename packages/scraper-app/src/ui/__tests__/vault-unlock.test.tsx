// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { VaultContext, type VaultStatus } from '../contexts/vault-context.js';
import { VaultUnlock } from '../screens/vault-unlock.js';

function makeCtx(
  overrides: Partial<{
    status: VaultStatus;
    error: string | null;
    unlock: (pw: string) => Promise<void>;
  }> = {},
) {
  return {
    status: 'locked' as VaultStatus,
    error: null as string | null,
    unlock: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    upload: vi.fn(),
    ...overrides,
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
    const unlock = vi.fn().mockResolvedValue(undefined);
    renderUnlock(makeCtx({ unlock }));

    await userEvent.type(screen.getByLabelText(/master password/i), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }));

    expect(unlock).toHaveBeenCalledWith('secret123');
  });

  it('shows an error message when unlock sets vault.error', async () => {
    // Stateful wrapper simulates the real context updating error after a failed unlock.
    function UnlockWrapper() {
      const [error, setError] = useState<string | null>(null);
      const unlock = vi.fn().mockImplementation(async () => {
        setError('Wrong password. Please try again.');
      });
      return (
        <VaultContext.Provider value={makeCtx({ error, unlock })}>
          <VaultUnlock />
        </VaultContext.Provider>
      );
    }
    render(<UnlockWrapper />);

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

describe('VaultContext upload shape', () => {
  it('renders without error when upload is provided in context', () => {
    function UploadWrapper() {
      const [status, setStatus] = useState<VaultStatus>('locked');
      const upload = vi.fn().mockImplementation(async () => setStatus('locked'));
      return (
        <VaultContext.Provider
          value={{ status, error: null, unlock: vi.fn(), create: vi.fn(), upload }}
        >
          <VaultUnlock />
        </VaultContext.Provider>
      );
    }
    render(<UploadWrapper />);
    expect(screen.getByLabelText(/master password/i)).toBeTruthy();
  });
});
