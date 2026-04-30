// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SourcesTab } from '../screens/config/sources-tab.js';
import type { SourceConfig } from '../screens/config/source-types.js';

function mockFetch(sources: SourceConfig[]) {
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    const method = options?.method ?? 'GET';

    if (method === 'GET') {
      return { ok: true, json: async () => sources } as Response;
    }

    if (method === 'POST') {
      const body = JSON.parse(options!.body as string) as Partial<SourceConfig>;
      const added = { ...body, id: 'new-id-1' } as SourceConfig;
      sources = [...sources, added];
      return { ok: true, json: async () => sources } as Response;
    }

    if (method === 'PUT') {
      const id = (url as string).split('/').pop()!;
      const patch = JSON.parse(options!.body as string) as Partial<SourceConfig>;
      sources = sources.map(s => (s.id === id ? { ...s, ...patch } : s));
      return { ok: true, json: async () => sources } as Response;
    }

    if (method === 'DELETE') {
      const id = (url as string).split('/').pop()!;
      sources = sources.filter(s => s.id !== id);
      return { ok: true, json: async () => sources } as Response;
    }

    return { ok: false, json: async () => ({}) } as Response;
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  mockFetch([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SourcesTab', () => {
  it('renders empty state message', async () => {
    render(<SourcesTab />);
    await waitFor(() => {
      expect(screen.getByText(/no sources configured/i)).toBeTruthy();
    });
  });

  it('renders a list of existing sources', async () => {
    const sources: SourceConfig[] = [
      { id: 's1', type: 'poalim', userCode: 'u1', password: 'p1', nickname: 'My Poalim' },
    ];
    vi.unstubAllGlobals();
    mockFetch(sources);

    render(<SourcesTab />);
    await waitFor(() => {
      expect(screen.getByText(/My Poalim/)).toBeTruthy();
    });
  });

  it('opens add form when Add Source is clicked', async () => {
    render(<SourcesTab />);
    await waitFor(() => screen.getByText(/no sources/i));

    await userEvent.click(screen.getByRole('button', { name: /add source/i }));
    expect(screen.getByRole('button', { name: /save/i })).toBeTruthy();
  });

  it('adds a poalim source via form submission', async () => {
    render(<SourcesTab />);
    await waitFor(() => screen.getByText(/no sources/i));

    await userEvent.click(screen.getByRole('button', { name: /add source/i }));

    await userEvent.type(screen.getByLabelText(/user code/i), 'user123');
    await userEvent.type(screen.getByLabelText(/^password/i), 'pass456');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull();
    });
  });

  it('opens edit form with existing values', async () => {
    const sources: SourceConfig[] = [
      { id: 's1', type: 'max', username: 'maxuser', password: 'pw', nickname: 'Max Account' },
    ];
    vi.unstubAllGlobals();
    mockFetch(sources);

    render(<SourcesTab />);
    await waitFor(() => screen.getByText(/Max Account/));

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect((screen.getByLabelText(/username/i) as HTMLInputElement).value).toBe('maxuser');
  });

  it('deletes a source when Delete is clicked', async () => {
    const sources: SourceConfig[] = [
      { id: 's1', type: 'max', username: 'maxuser', password: 'pw' },
    ];
    vi.unstubAllGlobals();
    mockFetch(sources);

    render(<SourcesTab />);
    await waitFor(() => screen.getByRole('button', { name: /^delete$/i }));

    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => screen.getByRole('button', { name: /confirm delete/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => {
      expect(screen.getByText(/no sources/i)).toBeTruthy();
    });
  });

  it('closes form on Cancel', async () => {
    render(<SourcesTab />);
    await waitFor(() => screen.getByText(/no sources/i));

    await userEvent.click(screen.getByRole('button', { name: /add source/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull();
  });
});
