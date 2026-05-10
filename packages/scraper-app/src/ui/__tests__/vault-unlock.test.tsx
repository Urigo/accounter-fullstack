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
    upload: (file: File, force?: boolean) => Promise<void>;
  }> = {},
) {
  return {
    status: 'locked' as VaultStatus,
    error: null as string | null,
    unlock: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    upload: vi.fn().mockResolvedValue(undefined),
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

describe('VaultUnlock — file upload', () => {
  it('renders the upload file input', () => {
    renderUnlock();
    expect(screen.getByLabelText(/upload vault file/i)).toBeTruthy();
  });

  it('calls vault.upload when a file is selected', async () => {
    const upload = vi.fn().mockResolvedValue(undefined);
    renderUnlock(makeCtx({ upload }));
    const input = screen.getByLabelText(/upload vault file/i);
    const file = new File(['blob'], 'test.vault');
    await userEvent.upload(input, file);
    expect(upload).toHaveBeenCalledWith(file);
  });

  it('shows confirm dialog and calls upload with force=true on 409', async () => {
    const ApiError = (await import('../lib/api.js')).ApiError;
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(409, 'vault-already-exists'))
      .mockResolvedValueOnce(undefined);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    renderUnlock(makeCtx({ upload }));
    await userEvent.upload(screen.getByLabelText(/upload vault file/i), new File(['b'], 'v'));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
    expect(upload).toHaveBeenLastCalledWith(expect.any(File), true);
    vi.unstubAllGlobals();
  });

  it('shows uploadError when force upload also fails', async () => {
    const upload = vi
      .fn()
      .mockRejectedValue(new (await import('../lib/api.js')).ApiError(409, 'x'));
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    renderUnlock(makeCtx({ upload }));
    await userEvent.upload(screen.getByLabelText(/upload vault file/i), new File(['b'], 'v'));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Failed to replace'),
    );
    vi.unstubAllGlobals();
  });
});
