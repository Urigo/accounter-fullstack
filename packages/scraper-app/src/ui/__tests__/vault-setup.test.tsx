// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { VaultContextValue } from '../contexts/vault-context.js';
import { VaultSetup } from '../screens/vault-setup.js';
import { makeVaultCtx, WithVault } from './helpers/vault-ctx.js';

function makeCtx(
  create: VaultContextValue['create'] = vi.fn().mockResolvedValue(true),
  overrides: Partial<VaultContextValue> = {},
) {
  return makeVaultCtx({ phase: 'creating', origin: null, fileName: null, create, ...overrides });
}

function renderSetup(ctx = makeCtx()) {
  return render(
    <WithVault ctx={ctx}>
      <VaultSetup />
    </WithVault>,
  );
}

async function completeWizard() {
  await userEvent.type(screen.getByLabelText(/master password/i), 'securePwd1!');
  await userEvent.type(screen.getByLabelText(/confirm password/i), 'securePwd1!');
  await userEvent.click(screen.getByRole('button', { name: /next/i }));
  await waitFor(() => screen.getByLabelText(/server url/i));
  await userEvent.click(screen.getByRole('button', { name: /next/i }));
  await waitFor(() => screen.getByText(/step 3/i));
  await userEvent.click(screen.getByRole('button', { name: /create vault/i }));
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
    await userEvent.click(screen.getByRole('button', { name: /^back$/i }));

    await waitFor(() => {
      expect(screen.getByText(/step 1/i)).toBeTruthy();
    });
  });
});

describe('VaultSetup — save step', () => {
  it('asks the user to save the new vault file after creating it', async () => {
    renderSetup();
    await completeWizard();
    await waitFor(() => screen.getByText(/your vault is ready/i));
    expect(screen.getByRole('button', { name: /save vault file/i })).toBeTruthy();
  });

  it('finishes setup once the file is saved', async () => {
    const ctx = makeCtx();
    renderSetup(ctx);
    await completeWizard();
    await userEvent.click(await screen.findByRole('button', { name: /save vault file/i }));
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.finishSetup).toHaveBeenCalled();
  });

  it('stays on the save step when the save dialog is cancelled', async () => {
    const ctx = makeCtx(undefined, { save: vi.fn().mockResolvedValue('cancelled') });
    renderSetup(ctx);
    await completeWizard();
    await userEvent.click(await screen.findByRole('button', { name: /save vault file/i }));
    expect(ctx.finishSetup).not.toHaveBeenCalled();
    expect(screen.getByText(/your vault is ready/i)).toBeTruthy();
  });

  it('lets the user skip saving for now', async () => {
    const ctx = makeCtx();
    renderSetup(ctx);
    await completeWizard();
    await userEvent.click(await screen.findByRole('button', { name: /do it later/i }));
    expect(ctx.finishSetup).toHaveBeenCalled();
  });

  it('labels the button as a download when the browser cannot pick a save location', async () => {
    renderSetup(makeCtx(undefined, { saveMode: 'download' }));
    await completeWizard();
    expect(await screen.findByRole('button', { name: /download vault file/i })).toBeTruthy();
  });

  it('keeps the wizard in place while the vault is being created', async () => {
    renderSetup(makeCtx(vi.fn(() => new Promise<boolean>(() => undefined))));
    await completeWizard();
    expect(screen.getByRole('button', { name: /creating…/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /back to start/i }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByRole('button', { name: /^back$/i }).hasAttribute('disabled')).toBe(true);
  });

  it('does not advance when creating the vault fails', async () => {
    renderSetup(makeCtx(vi.fn().mockResolvedValue(false)));
    await completeWizard();
    expect(screen.queryByText(/your vault is ready/i)).toBeNull();
  });
});
