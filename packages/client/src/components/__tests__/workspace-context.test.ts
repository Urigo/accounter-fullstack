// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useAuth0Mock } = vi.hoisted(() => ({
  useAuth0Mock: vi.fn(),
}));

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: useAuth0Mock,
}));

vi.mock('urql', () => ({
  useQuery: useQueryMock,
}));

import {
  WorkspaceProvider,
  useWorkspace,
  useWorkspaceDisplayName,
  useWorkspaceLogo,
} from '../../providers/workspace-provider.js';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function TestConsumer() {
  const { workspace, isLoading, error } = useWorkspace();
  const displayName = useWorkspaceDisplayName();
  const logo = useWorkspaceLogo();
  return React.createElement(
    'div',
    null,
    React.createElement('span', { 'data-testid': 'name' }, displayName),
    React.createElement('span', { 'data-testid': 'logo' }, logo || 'none'),
    React.createElement('span', { 'data-testid': 'loading' }, String(isLoading)),
    React.createElement('span', { 'data-testid': 'error' }, error || 'none'),
    React.createElement('span', { 'data-testid': 'has-workspace' }, String(!!workspace)),
  );
}

async function renderProvider(queryReturn: {
  data: Record<string, unknown> | undefined;
  fetching: boolean;
  error: { message: string } | null;
}) {
  useAuth0Mock.mockReturnValue({ isAuthenticated: true });
  useQueryMock.mockReturnValue([queryReturn, vi.fn()]);

  const container = document.createElement('div');
  document.body.append(container);

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(
        WorkspaceProvider,
        null,
        React.createElement(TestConsumer),
      ),
    );
    await Promise.resolve();
  });

  const getText = (testId: string) =>
    container.querySelector(`[data-testid="${testId}"]`)?.textContent || '';

  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };

  return { getText, cleanup };
}

describe('WorkspaceProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides workspace data when available', async () => {
    const { getText, cleanup } = await renderProvider({
      data: {
        workspaceSettings: {
          id: 'ws-1',
          ownerId: 'biz-1',
          companyName: 'Acme Corp',
          logoUrl: 'https://example.com/logo.png',
        },
      },
      fetching: false,
      error: null,
    });

    expect(getText('name')).toBe('Acme Corp');
    expect(getText('logo')).toBe('https://example.com/logo.png');
    expect(getText('has-workspace')).toBe('true');
    await cleanup();
  });

  it('falls back to "Accounter" when no workspace settings', async () => {
    const { getText, cleanup } = await renderProvider({
      data: { workspaceSettings: null },
      fetching: false,
      error: null,
    });

    expect(getText('name')).toBe('Accounter');
    expect(getText('logo')).toBe('none');
    expect(getText('has-workspace')).toBe('false');
    await cleanup();
  });

  it('reports loading state', async () => {
    const { getText, cleanup } = await renderProvider({
      data: undefined,
      fetching: true,
      error: null,
    });

    expect(getText('loading')).toBe('true');
    await cleanup();
  });

  it('reports error state', async () => {
    const { getText, cleanup } = await renderProvider({
      data: undefined,
      fetching: false,
      error: { message: 'Network error' },
    });

    expect(getText('error')).toBe('Network error');
    expect(getText('has-workspace')).toBe('false');
    await cleanup();
  });

  it('falls back to "Accounter" on error', async () => {
    const { getText, cleanup } = await renderProvider({
      data: undefined,
      fetching: false,
      error: { message: 'Unauthorized' },
    });

    expect(getText('name')).toBe('Accounter');
    await cleanup();
  });
});

describe('Workspace hooks outside provider', () => {
  it('useWorkspaceDisplayName returns fallback without provider', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    function Bare() {
      const name = useWorkspaceDisplayName();
      return React.createElement('span', null, name);
    }

    let root: Root | null = null;
    await act(async () => {
      root = createRoot(container);
      root.render(React.createElement(Bare));
      await Promise.resolve();
    });

    expect(container.textContent).toBe('Accounter');

    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  });
});
