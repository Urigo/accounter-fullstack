// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useQueryMock, useMutationMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useMutationMock: vi.fn(),
}));

vi.mock('urql', () => ({
  useQuery: useQueryMock,
  useMutation: useMutationMock,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ConnectedSources } from '../screens/settings/connected-sources.js';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeMockSource(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '1',
    provider: 'HAPOALIM',
    displayName: 'Main Account',
    accountIdentifier: null,
    status: 'ACTIVE',
    hasCredentials: false,
    credentialsSummary: [],
    lastSyncAt: null,
    lastSyncError: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

async function render() {
  const container = document.createElement('div');
  document.body.append(container);
  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(ConnectedSources));
    await Promise.resolve();
  });

  const html = container.innerHTML;
  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };

  return { container, html, cleanup };
}

describe('ConnectedSources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMutationMock.mockReturnValue([
      { fetching: false },
      vi.fn().mockResolvedValue({ data: {}, error: undefined }),
    ]);
  });

  it('renders loading state', async () => {
    useQueryMock.mockReturnValue([
      { data: null, fetching: true, error: null },
      vi.fn(),
    ]);

    const { html, cleanup } = await render();
    expect(html).toContain('animate-spin');
    await cleanup();
  });

  it('renders error state', async () => {
    useQueryMock.mockReturnValue([
      { data: null, fetching: false, error: new Error('Network error') },
      vi.fn(),
    ]);

    const { html, cleanup } = await render();
    expect(html).toContain('Failed to load source connections');
    await cleanup();
  });

  it('renders empty state when no sources exist', async () => {
    useQueryMock.mockReturnValue([
      { data: { sourceConnections: [] }, fetching: false, error: null },
      vi.fn(),
    ]);

    const { html, cleanup } = await render();
    expect(html).toContain('No sources connected');
    await cleanup();
  });

  it('renders bank source with correct status', async () => {
    useQueryMock.mockReturnValue([
      {
        data: {
          sourceConnections: [
            makeMockSource({
              provider: 'HAPOALIM',
              displayName: 'Main Account',
              accountIdentifier: '12345',
              status: 'ACTIVE',
              hasCredentials: true,
              credentialsSummary: [
                { key: 'userCode', label: 'User Code', type: 'text', required: true, hasValue: true, maskedValue: 'BG****20', placeholder: null },
                { key: 'password', label: 'Password', type: 'password', required: true, hasValue: true, maskedValue: '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022', placeholder: null },
              ],
              lastSyncAt: new Date().toISOString(),
            }),
          ],
        },
        fetching: false,
        error: null,
      },
      vi.fn(),
    ]);

    const { html, cleanup } = await render();
    expect(html).toContain('Main Account');
    expect(html).toContain('Bank Hapoalim');
    expect(html).toContain('12345');
    expect(html).toContain('Connected');
    expect(html).toContain('Bank Accounts');
    await cleanup();
  });

  it('renders card source in Credit Cards section', async () => {
    useQueryMock.mockReturnValue([
      {
        data: {
          sourceConnections: [
            makeMockSource({
              id: '2',
              provider: 'ISRACARD',
              displayName: 'Business Card',
              status: 'PENDING',
            }),
          ],
        },
        fetching: false,
        error: null,
      },
      vi.fn(),
    ]);

    const { html, cleanup } = await render();
    expect(html).toContain('Business Card');
    expect(html).toContain('Credit Cards');
    expect(html).toContain('Pending');
    await cleanup();
  });

  it('renders error status badge', async () => {
    useQueryMock.mockReturnValue([
      {
        data: {
          sourceConnections: [
            makeMockSource({
              id: '3',
              provider: 'MIZRAHI',
              displayName: 'Savings',
              status: 'ERROR',
              hasCredentials: true,
              lastSyncAt: '2026-03-10T12:00:00Z',
              lastSyncError: 'Login failed',
            }),
          ],
        },
        fetching: false,
        error: null,
      },
      vi.fn(),
    ]);

    const { html, cleanup } = await render();
    expect(html).toContain('Error');
    expect(html).toContain('Login failed');
    await cleanup();
  });

  it('renders disconnected status badge', async () => {
    useQueryMock.mockReturnValue([
      {
        data: {
          sourceConnections: [
            makeMockSource({
              id: '4',
              provider: 'DISCOUNT',
              displayName: 'Old Account',
              status: 'DISCONNECTED',
            }),
          ],
        },
        fetching: false,
        error: null,
      },
      vi.fn(),
    ]);

    const { html, cleanup } = await render();
    expect(html).toContain('Disconnected');
    await cleanup();
  });

  it('groups sources by category (banks, cards, integrations)', async () => {
    useQueryMock.mockReturnValue([
      {
        data: {
          sourceConnections: [
            makeMockSource({ id: '1', provider: 'HAPOALIM', displayName: 'Bank' }),
            makeMockSource({ id: '2', provider: 'ISRACARD', displayName: 'Card' }),
            makeMockSource({ id: '3', provider: 'GREEN_INVOICE', displayName: 'GreenInvoice' }),
          ],
        },
        fetching: false,
        error: null,
      },
      vi.fn(),
    ]);

    const { html, cleanup } = await render();
    expect(html).toContain('Bank Accounts');
    expect(html).toContain('Credit Cards');
    expect(html).toContain('Integrations');
    await cleanup();
  });

  it('does not expose raw secret values or env key names', async () => {
    useQueryMock.mockReturnValue([
      {
        data: {
          sourceConnections: [
            makeMockSource({
              provider: 'HAPOALIM',
              displayName: 'Main',
              hasCredentials: true,
              credentialsSummary: [
                { key: 'userCode', label: 'User Code', type: 'text', required: true, hasValue: true, maskedValue: 'BG****20', placeholder: null },
              ],
            }),
          ],
        },
        fetching: false,
        error: null,
      },
      vi.fn(),
    ]);

    const { html, cleanup } = await render();
    expect(html).not.toContain('POALIM_USERNAME');
    expect(html).not.toContain('.env');
    expect(html).not.toContain('BG98920');
    expect(html).toContain('BG****20');
    await cleanup();
  });

  it('shows masked credential summary for configured sources', async () => {
    useQueryMock.mockReturnValue([
      {
        data: {
          sourceConnections: [
            makeMockSource({
              provider: 'ISRACARD',
              displayName: 'My Card',
              hasCredentials: true,
              credentialsSummary: [
                { key: 'id', label: 'ID Number', type: 'id', required: true, hasValue: true, maskedValue: '******789', placeholder: null },
                { key: 'password', label: 'Password', type: 'password', required: true, hasValue: true, maskedValue: '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022', placeholder: null },
                { key: 'last6Digits', label: 'Last 6 Digits', type: 'text', required: true, hasValue: true, maskedValue: '65**21', placeholder: null },
              ],
            }),
          ],
        },
        fetching: false,
        error: null,
      },
      vi.fn(),
    ]);

    const { html, cleanup } = await render();
    expect(html).toContain('ID Number');
    expect(html).toContain('******789');
    expect(html).toContain('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022');
    expect(html).toContain('Configured');
    await cleanup();
  });

  it('shows "Not configured" badge when no credentials', async () => {
    useQueryMock.mockReturnValue([
      {
        data: {
          sourceConnections: [
            makeMockSource({
              provider: 'MIZRAHI',
              displayName: 'Test',
              hasCredentials: false,
            }),
          ],
        },
        fetching: false,
        error: null,
      },
      vi.fn(),
    ]);

    const { html, cleanup } = await render();
    expect(html).toContain('Not configured');
    expect(html).toContain('Configure');
    await cleanup();
  });

  it('shows "Never" for sources that have not synced', async () => {
    useQueryMock.mockReturnValue([
      {
        data: {
          sourceConnections: [
            makeMockSource({
              provider: 'MIZRAHI',
              displayName: 'Test',
              status: 'PENDING',
            }),
          ],
        },
        fetching: false,
        error: null,
      },
      vi.fn(),
    ]);

    const { html, cleanup } = await render();
    expect(html).toContain('Never');
    await cleanup();
  });
});
