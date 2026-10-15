// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { VaultChanges } from '../../shared/types.js';
import type { VaultContextValue } from '../contexts/vault-context.js';
import { UnsavedBanner } from '../components/unsaved-banner.js';
import { makeVaultCtx, WithVault } from './helpers/vault-ctx.js';

const DIRTY: VaultChanges = {
  dirty: true,
  neverSaved: false,
  items: [
    { section: 'sources', kind: 'added', id: 's1', sourceType: 'poalim', label: 'Business' },
    { section: 'accounts', kind: 'added', id: 'a1', sourceType: 'poalim', label: '700-555' },
    { section: 'settings', kind: 'edited', id: 'defaultDateRangeMonths', label: 'x' },
  ],
};

function renderBanner(overrides: Partial<VaultContextValue> = {}) {
  const ctx = makeVaultCtx({ changes: DIRTY, ...overrides });
  const view = render(
    <WithVault ctx={ctx}>
      <UnsavedBanner />
    </WithVault>,
  );
  return { ctx, ...view };
}

describe('UnsavedBanner', () => {
  it('renders nothing when the vault matches the file', () => {
    const { container } = renderBanner({
      changes: { dirty: false, neverSaved: false, items: [] },
    });
    expect(container.innerHTML).toBe('');
  });

  it('counts the unsaved changes and names the file', () => {
    renderBanner();
    expect(screen.getByText(/3 unsaved changes to mine\.vault/i)).toBeTruthy();
  });

  it('lists the changes grouped by section on demand', async () => {
    renderBanner();
    await userEvent.click(screen.getByRole('button', { name: /review changes/i }));
    expect(screen.getByRole('heading', { name: 'Credentials' })).toBeTruthy();
    expect(screen.getByText('Bank Hapoalim: Business')).toBeTruthy();
    expect(screen.getByText(/account 700-555/)).toBeTruthy();
    expect(screen.getByText('Default date range')).toBeTruthy();
  });

  it('saves in place to the opened file and confirms', async () => {
    const save = vi.fn().mockResolvedValue('saved');
    const view = renderBanner({ save });
    await userEvent.click(screen.getByRole('button', { name: /save to mine\.vault/i }));
    expect(save).toHaveBeenCalled();

    // Once saved, the context reports a clean vault; the banner turns into a confirmation.
    view.rerender(
      <WithVault
        ctx={makeVaultCtx({ save, changes: { dirty: false, neverSaved: false, items: [] } })}
      >
        <UnsavedBanner />
      </WithVault>,
    );
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Saved to'));
  });

  it('offers a download instead when the browser cannot overwrite files', () => {
    renderBanner({ saveMode: 'download' });
    expect(screen.getByRole('button', { name: /download updated vault/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /download copy/i })).toBeNull();
  });

  it('download copy does not save', async () => {
    const { ctx } = renderBanner();
    await userEvent.click(screen.getByRole('button', { name: /download copy/i }));
    expect(ctx.downloadCopy).toHaveBeenCalled();
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('calls out a new vault that was never saved', () => {
    renderBanner({ changes: { ...DIRTY, neverSaved: true } });
    expect(screen.getByText(/hasn’t been saved to a file yet/i)).toBeTruthy();
  });

  it('explains when the browser refuses to write the file', async () => {
    renderBanner({ save: vi.fn().mockResolvedValue('denied') });
    await userEvent.click(screen.getByRole('button', { name: /save to mine\.vault/i }));
    expect((await screen.findByRole('alert')).textContent).toContain('not allowed');
  });

  it('keeps a download unsaved until the user confirms they kept the file', async () => {
    const confirmDownloaded = vi.fn().mockResolvedValue(undefined);
    renderBanner({ saveMode: 'download', pendingDownload: true, confirmDownloaded });
    expect(screen.getByText(/3 unsaved changes/i)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /i’ve replaced it/i }));
    expect(confirmDownloaded).toHaveBeenCalledOnce();
  });

  it('does not offer the confirmation before anything was downloaded', () => {
    renderBanner({ saveMode: 'download' });
    expect(screen.queryByRole('button', { name: /i’ve replaced it/i })).toBeNull();
  });

  it('disables saving while another save is in progress', () => {
    renderBanner({ saving: true });
    expect(screen.getByRole('button', { name: /saving…/i }).hasAttribute('disabled')).toBe(true);
  });

  it('explains when the vault was closed in another tab', async () => {
    renderBanner({ save: vi.fn().mockResolvedValue('session-changed') });
    await userEvent.click(screen.getByRole('button', { name: /save to mine\.vault/i }));
    expect((await screen.findByRole('alert')).textContent).toContain('another tab');
  });
});
