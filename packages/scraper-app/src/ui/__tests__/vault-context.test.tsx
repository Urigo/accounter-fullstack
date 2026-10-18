// @vitest-environment happy-dom

import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VaultChanges, VaultStatusResponse } from '../../shared/types.js';
import { useVault, VaultProvider } from '../contexts/vault-context.js';
import * as api from '../lib/api.js';

vi.mock('../lib/api.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../lib/api.js')>()),
  vaultStatus: vi.fn(),
  vaultChanges: vi.fn(),
}));

const CLEAN: VaultChanges = { dirty: false, neverSaved: false, items: [] };
const DIRTY: VaultChanges = {
  dirty: true,
  neverSaved: false,
  items: [{ section: 'settings', kind: 'edited', id: 'showBrowser', label: 'showBrowser' }],
};

function unlocked(sessionId: string, changes = CLEAN): VaultStatusResponse {
  return { state: 'unlocked', sessionId, origin: 'opened', fileName: 'mine.vault', changes };
}

function Probe() {
  const vault = useVault();
  return (
    <p data-testid="probe">
      {vault.phase}:{vault.fileName}:{vault.changes?.dirty ? 'dirty' : 'clean'}
    </p>
  );
}

async function renderUnlocked() {
  render(
    <VaultProvider>
      <Probe />
    </VaultProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('probe').textContent).toMatch(/^unlocked/));
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => (resolve = r));
  return { promise, resolve };
}

afterEach(() => vi.mocked(api.vaultChanges).mockReset());

describe('VaultProvider', () => {
  it('ignores a change report that was overtaken by a newer one', async () => {
    vi.mocked(api.vaultStatus).mockResolvedValue(unlocked('s1'));
    await renderUnlocked();

    const older = deferred<VaultChanges>();
    const newer = deferred<VaultChanges>();
    vi.mocked(api.vaultChanges)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    act(() => {
      api.vaultEvents.dispatchEvent(new Event('vault-changed'));
      api.vaultEvents.dispatchEvent(new Event('vault-changed'));
    });

    await act(async () => newer.resolve(DIRTY));
    await act(async () => older.resolve(CLEAN));
    expect(screen.getByTestId('probe').textContent).toBe('unlocked:mine.vault:dirty');
  });

  it('picks up changes made in another tab', async () => {
    vi.mocked(api.vaultStatus).mockResolvedValue(unlocked('s1'));
    await renderUnlocked();

    vi.mocked(api.vaultStatus).mockResolvedValue(unlocked('s1', DIRTY));
    act(() => void api.vaultEvents.dispatchEvent(new Event('vault-remote')));
    await waitFor(() =>
      expect(screen.getByTestId('probe').textContent).toBe('unlocked:mine.vault:dirty'),
    );
  });

  it('returns to the welcome screen when another tab closed the vault', async () => {
    vi.mocked(api.vaultStatus).mockResolvedValue(unlocked('s1'));
    await renderUnlocked();

    vi.mocked(api.vaultStatus).mockResolvedValue({ state: 'empty' });
    act(() => void window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toMatch(/^welcome/));
  });
});
