// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { VaultContext, type VaultStatus } from '../contexts/vault-context.js';
import { VaultSetup } from '../screens/vault-setup.js';

function makeCtx(
  create: () => Promise<void> = vi.fn().mockResolvedValue(undefined),
  upload: () => Promise<void> = vi.fn().mockResolvedValue(undefined),
  error: string | null = null,
) {
  return {
    status: 'no-file' as VaultStatus,
    error,
    unlock: vi.fn(),
    create,
    upload,
  };
}

function renderSetup(ctx = makeCtx()) {
  return render(
    <VaultContext.Provider value={ctx}>
      <VaultSetup />
    </VaultContext.Provider>,
  );
}

describe('VaultSetup', () => {
  it('renders step 1 on mount', () => {
    renderSetup();
    expect(screen.getByText(/step 1/i)).toBeTruthy();
    expect(screen.getByLabelText(/master password/i)).toBeTruthy();
  });

  it('shows error when passwords do not match', async () => {
    renderSetup();
    await userEvent.type(screen.getByLabelText(/master password/i), 'password1!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'different!');
    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('do not match');
    });
  });

  it('shows error when password is too short', async () => {
    renderSetup();
    await userEvent.type(screen.getByLabelText(/master password/i), 'short');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'short');
    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('8 characters');
    });
  });

  it('advances to step 2 after valid password', async () => {
    renderSetup();
    await userEvent.type(screen.getByLabelText(/master password/i), 'securePwd1!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'securePwd1!');
    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/step 2/i)).toBeTruthy();
    });
  });

  it('completes the full wizard and calls create', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    renderSetup(makeCtx(create));

    // Step 1
    await userEvent.type(screen.getByLabelText(/master password/i), 'securePwd1!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'securePwd1!');
    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 2
    await waitFor(() => screen.getByLabelText(/server url/i));
    await userEvent.type(screen.getByLabelText(/server url/i), 'http://localhost:4000');
    await userEvent.type(screen.getByLabelText(/api key/i), 'my-api-key');
    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 3
    await waitFor(() => screen.getByText(/step 3/i));
    expect(screen.getByText(/http:\/\/localhost:4000/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /create vault/i }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith('securePwd1!', 'http://localhost:4000', 'my-api-key');
    });
  });

  it('can navigate back from step 2 to step 1', async () => {
    renderSetup();
    await userEvent.type(screen.getByLabelText(/master password/i), 'securePwd1!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'securePwd1!');
    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByText(/step 2/i));
    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    await waitFor(() => {
      expect(screen.getByText(/step 1/i)).toBeTruthy();
    });
  });
});

describe('VaultSetup — file upload', () => {
  it('renders the upload file input alongside the wizard', () => {
    renderSetup();
    expect(screen.getByLabelText(/upload an existing vault/i)).toBeTruthy();
    expect(screen.getByText(/step 1/i)).toBeTruthy();
  });

  it('calls vault.upload when a file is selected', async () => {
    const upload = vi.fn().mockResolvedValue(undefined);
    renderSetup(makeCtx(vi.fn(), upload));
    const file = new File(['blob'], 'test.vault');
    await userEvent.upload(screen.getByLabelText(/upload an existing vault/i), file);
    expect(upload).toHaveBeenCalledWith(file);
  });

  it('shows uploadError when upload fails', async () => {
    const upload = vi.fn().mockRejectedValue(new Error('fail'));
    renderSetup(makeCtx(vi.fn(), upload));
    await userEvent.upload(
      screen.getByLabelText(/upload an existing vault/i),
      new File(['b'], 'v'),
    );
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Failed to upload'),
    );
  });
});
