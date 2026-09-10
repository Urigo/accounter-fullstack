// @vitest-environment happy-dom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLogout } from '../use-logout.js';
import { ROUTES } from '../../router/routes.js';

const { useAuth0Mock, logoutMock, resetClientMock, callOrder } = vi.hoisted(() => {
  const order: string[] = [];
  return {
    useAuth0Mock: vi.fn(),
    logoutMock: vi.fn(() => {
      order.push('logout');
      return Promise.resolve();
    }),
    resetClientMock: vi.fn(() => {
      order.push('reset');
    }),
    callOrder: order,
  };
});

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: useAuth0Mock,
}));

vi.mock('../../providers/urql.js', () => ({
  resetUrqlClientAndNotify: resetClientMock,
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

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('useLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    localStorage.clear();
    sessionStorage.clear();

    callOrder.length = 0;
    useAuth0Mock.mockReturnValue({ logout: logoutMock });
  });

  it('discards the urql client on logout', async () => {
    const { container, cleanup } = await renderHarness();
    const button = container.querySelector('button');

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(resetClientMock).toHaveBeenCalledTimes(1);

    await cleanup();
  });

  it('discards the client before Auth0 navigates away', async () => {
    // `logout()` triggers a full-page redirect, so anything queued after it is
    // not guaranteed to run. The reset has to happen first.
    const { container, cleanup } = await renderHarness();
    const button = container.querySelector('button');

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(callOrder).toEqual(['reset', 'logout']);

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
