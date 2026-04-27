// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Config } from '../screens/Config/config.js';

function mockFetchEmpty() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/vault/sources') return { ok: true, json: async () => [] } as Response;
      if (url === '/api/vault/accounts') return { ok: true, json: async () => [] } as Response;
      if (url === '/api/vault/settings')
        return {
          ok: true,
          json: async () => ({
            showBrowser: false,
            fetchBankOfIsraelRates: true,
            concurrentScraping: true,
          }),
        } as Response;
      return { ok: false, json: async () => ({}) } as Response;
    }),
  );
}

beforeEach(() => {
  mockFetchEmpty();
});

describe('Config tab navigation', () => {
  it('renders Sources tab by default', async () => {
    render(<Config />);
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Sources' })).toBeTruthy();
    });
    expect(screen.getByRole('tab', { name: 'Sources' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(/no sources configured/i)).toBeTruthy();
  });

  it('switches to Settings tab on click', async () => {
    render(<Config />);
    await waitFor(() => screen.getByRole('tab', { name: 'Settings' }));

    await userEvent.click(screen.getByRole('tab', { name: 'Settings' }));

    await waitFor(() => {
      expect(screen.getByLabelText(/show browser/i)).toBeTruthy();
    });
    expect(screen.getByRole('tab', { name: 'Settings' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Sources' }).getAttribute('aria-selected')).toBe('false');
  });

  it('switches to Accounts tab on click', async () => {
    render(<Config />);
    await waitFor(() => screen.getByRole('tab', { name: 'Accounts' }));

    await userEvent.click(screen.getByRole('tab', { name: 'Accounts' }));

    await waitFor(() => {
      expect(screen.getByText(/no bank accounts discovered/i)).toBeTruthy();
    });
    expect(screen.getByRole('tab', { name: 'Accounts' }).getAttribute('aria-selected')).toBe('true');
  });

  it('only renders the active panel', async () => {
    render(<Config />);
    await waitFor(() => screen.getByText(/no sources/i));

    expect(screen.queryByLabelText(/show browser/i)).toBeNull();
    expect(screen.queryByText(/no bank accounts/i)).toBeNull();
  });

  it('can navigate back to Sources after switching away', async () => {
    render(<Config />);
    await waitFor(() => screen.getByText(/no sources/i));

    await userEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    await waitFor(() => screen.getByLabelText(/show browser/i));

    await userEvent.click(screen.getByRole('tab', { name: 'Sources' }));
    await waitFor(() => {
      expect(screen.getByText(/no sources configured/i)).toBeTruthy();
    });
  });
});
