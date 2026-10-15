// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { VaultMenu } from '../components/vault-menu.js';
import type { VaultContextValue } from '../contexts/vault-context.js';
import { ApiError } from '../lib/api.js';
import { makeVaultCtx, WithVault } from './helpers/vault-ctx.js';

function renderMenu(overrides: Partial<VaultContextValue> = {}) {
  const ctx = makeVaultCtx(overrides);
  render(
    <WithVault ctx={ctx}>
      <VaultMenu />
    </WithVault>,
  );
  return ctx;
}

async function openMenu() {
  await userEvent.click(screen.getByRole('button', { name: /vault mine\.vault/i }));
}

describe('VaultMenu', () => {
  it('closes a clean vault straight away', async () => {
    const ctx = renderMenu();
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /close vault/i }));
    expect(ctx.close).toHaveBeenCalledOnce();
  });

  it('explains why the vault could not be closed during a scrape', async () => {
    renderMenu({ close: vi.fn().mockRejectedValue(new ApiError(409, 'run-in-progress')) });
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /close vault/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/scrape is running/i);
  });

  it('reports other close failures', async () => {
    renderMenu({ close: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) });
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /close vault/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not close/i);
  });

  it('disables Save while a save is in progress', async () => {
    renderMenu({ saving: true });
    await openMenu();
    expect(screen.getByRole('menuitem', { name: /^save$/i }).hasAttribute('disabled')).toBe(true);
  });
});
