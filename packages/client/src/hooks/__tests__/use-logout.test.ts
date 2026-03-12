// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLogout } from '../use-logout.js';
import { ROUTES } from '../../router/routes.js';

const { useAuth0Mock, useClientMock, logoutMock, resetStoreMock } = vi.hoisted(() => ({
  useAuth0Mock: vi.fn(),
  useClientMock: vi.fn(),
  logoutMock: vi.fn(),
  resetStoreMock: vi.fn(),
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: useAuth0Mock,
}));

vi.mock('urql', () => ({
  useClient: useClientMock,
}));

function LogoutHarness(): React.ReactElement {
  const logout = useLogout();

  return React.createElement('button', { onClick: () => void logout() }, 'Log out');
}

async function renderHarness() {
  const container = document.createElement('div');
  document.body.append(container);

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(LogoutHarness));
    await Promise.resolve();
  });

  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };

  return { container, cleanup };
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('useLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    localStorage.clear();
    sessionStorage.clear();

    logoutMock.mockResolvedValue(undefined);
    useAuth0Mock.mockReturnValue({ logout: logoutMock });
    useClientMock.mockReturnValue({ resetStore: resetStoreMock });
  });

  it.skip('calls urqlClient.resetStore()', async () => {
    const { container, cleanup } = await renderHarness();
    const button = container.querySelector('button');

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(resetStoreMock).toHaveBeenCalledTimes(1);

    await cleanup();
  });

  it('calls Auth0 logout with login returnTo', async () => {
    const { container, cleanup } = await renderHarness();
    const button = container.querySelector('button');

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(logoutMock).toHaveBeenCalledWith({
      logoutParams: {
        returnTo: `${window.location.origin}${ROUTES.LOGIN}`,
      },
    });

    await cleanup();
  });
});
