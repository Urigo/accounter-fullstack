// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Welcome } from '../screens/welcome.js';
import { makeVaultCtx, WithVault } from './helpers/vault-ctx.js';

function renderWelcome(ctx = makeVaultCtx({ phase: 'welcome' })) {
  render(
    <WithVault ctx={ctx}>
      <Welcome />
    </WithVault>,
  );
  return ctx;
}

afterEach(() => {
  delete (window as { showOpenFilePicker?: unknown }).showOpenFilePicker;
});

describe('Welcome', () => {
  it('offers both ways in: open an existing vault or create one', () => {
    renderWelcome();
    expect(screen.getByRole('heading', { name: /open my vault/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /create a new vault/i })).toBeTruthy();
    expect(screen.getByText(/how saving works/i)).toBeTruthy();
  });

  it('starts the create wizard', async () => {
    const ctx = renderWelcome();
    await userEvent.click(screen.getByRole('button', { name: /get started/i }));
    expect(ctx.startCreate).toHaveBeenCalled();
  });

  it('falls back to a file input when the browser has no file picker API', async () => {
    const ctx = renderWelcome();
    const file = new File(['QUJD'], 'mine.vault');
    await userEvent.upload(screen.getByLabelText(/vault file/i), file);
    expect(ctx.chooseFile).toHaveBeenCalledWith({ file, handle: null });
  });

  it('uses the native picker, keeping the file handle, when available', async () => {
    const file = new File(['QUJD'], 'mine.vault');
    const handle = { getFile: vi.fn().mockResolvedValue(file) };
    (window as { showOpenFilePicker?: unknown }).showOpenFilePicker = vi
      .fn()
      .mockResolvedValue([handle]);
    const ctx = renderWelcome();
    await userEvent.click(screen.getByRole('button', { name: /choose file/i }));
    expect(ctx.chooseFile).toHaveBeenCalledWith({ file, handle });
  });

  it('does nothing when the native picker is cancelled', async () => {
    (window as { showOpenFilePicker?: unknown }).showOpenFilePicker = vi
      .fn()
      .mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    const ctx = renderWelcome();
    await userEvent.click(screen.getByRole('button', { name: /choose file/i }));
    expect(ctx.chooseFile).not.toHaveBeenCalled();
  });
});
