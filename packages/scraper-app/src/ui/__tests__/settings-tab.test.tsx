// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsTab } from '../screens/config/settings-tab.js';

const DEFAULT_SETTINGS = {
  showBrowser: false,
  fetchBankOfIsraelRates: true,
  concurrentScraping: true,
};

function mockFetch(settings = DEFAULT_SETTINGS) {
  let current = { ...settings };
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/vault/settings') {
      if (!options || options.method !== 'PUT') {
        return { ok: true, json: async () => ({ ...current }) } as Response;
      }
      const patch = JSON.parse(options.body as string) as typeof current;
      current = { ...current, ...patch };
      return { ok: true, json: async () => ({ ...current }) } as Response;
    }
    if (url === '/api/vault/path') return { ok: true, json: async () => ({ path: '/data/.vault' }) } as Response;
    if (url === '/api/vault/env-path') return { ok: true, json: async () => ({ path: '.vault' }) } as Response;
    return { ok: false, json: async () => ({}) } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  mockFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SettingsTab', () => {
  it('renders boolean toggles', async () => {
    render(<SettingsTab />);
    await waitFor(() => screen.getByLabelText(/show browser/i));
    expect(screen.getByLabelText(/show browser/i)).toBeTruthy();
    expect(screen.getByLabelText(/fetch bank of israel/i)).toBeTruthy();
    expect(screen.getByLabelText(/scrape sources concurrently/i)).toBeTruthy();
  });

  it('renders number and text fields', async () => {
    render(<SettingsTab />);
    await waitFor(() => screen.getByLabelText(/default date range/i));
    expect(screen.getByLabelText(/history file path/i)).toBeTruthy();
  });

  it('auto-saves on toggle change', async () => {
    const fetchMock = mockFetch();
    render(<SettingsTab />);
    await waitFor(() => screen.getByLabelText(/show browser/i));

    await userEvent.click(screen.getByLabelText(/show browser/i));

    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(
        ([, opts]) => (opts as RequestInit | undefined)?.method === 'PUT',
      );
      expect(putCalls.length).toBeGreaterThan(0);
      const body = JSON.parse(putCalls[0][1]!.body as string) as { showBrowser: boolean };
      expect(body.showBrowser).toBe(true);
    });
  });

  it('reflects initial values from the server', async () => {
    mockFetch({ ...DEFAULT_SETTINGS, showBrowser: true });
    render(<SettingsTab />);
    await waitFor(() => {
      expect((screen.getByLabelText(/show browser/i) as HTMLInputElement).checked).toBe(true);
    });
  });

  it('renders the vault path input as editable', async () => {
    render(<SettingsTab />);
    await waitFor(() => screen.getByLabelText(/vault file path/i));
    const input = screen.getByLabelText(/vault file path/i) as HTMLInputElement;
    expect(input.readOnly).toBe(false);
  });

  it('saves vaultPath to settings on blur', async () => {
    const fetchMock = mockFetch();
    render(<SettingsTab />);
    await waitFor(() => screen.getByLabelText(/vault file path/i));
    const input = screen.getByLabelText(/vault file path/i);
    await userEvent.clear(input);
    await userEvent.type(input, '/new/path/.vault');
    await userEvent.tab();
    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(([, opts]) => (opts as RequestInit | undefined)?.method === 'PUT');
      const bodies = putCalls.map(([, opts]) => JSON.parse((opts as RequestInit)!.body as string) as Record<string, unknown>);
      expect(bodies.some(b => b.vaultPath === '/new/path/.vault')).toBe(true);
    });
  });

  it('renders the Download button', async () => {
    render(<SettingsTab />);
    await waitFor(() => screen.getByRole('button', { name: /download/i }));
    expect(screen.getByRole('button', { name: /download/i })).toBeTruthy();
  });

  it('calls vaultDownload when Download is clicked', async () => {
    vi.mock('../../lib/api.js', async importOriginal => {
      const mod = await importOriginal<typeof import('../../lib/api.js')>();
      return { ...mod, vaultDownload: vi.fn().mockResolvedValue(undefined) };
    });
    render(<SettingsTab />);
    await waitFor(() => screen.getByRole('button', { name: /download/i }));
    await userEvent.click(screen.getByRole('button', { name: /download/i }));
    const { vaultDownload } = await import('../../lib/api.js');
    expect(vaultDownload).toHaveBeenCalled();
  });
});
