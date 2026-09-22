import { describe, expect, it, vi } from 'vitest';
import {
  createAuth0AccessTokenProvider,
  type GetAccessTokenSilently,
} from '../auth0-token-provider.js';

const AUDIENCE = 'https://api.example.com';

function auth0Error(code: string, message = code): Error & { error?: string } {
  return Object.assign(new Error(message), { error: code });
}

describe('createAuth0AccessTokenProvider', () => {
  it('resolves a token to the "token" status', async () => {
    const getAccessTokenSilently = vi
      .fn<GetAccessTokenSilently>()
      .mockResolvedValue('access-token');
    const provider = createAuth0AccessTokenProvider(getAccessTokenSilently, AUDIENCE);

    await expect(provider()).resolves.toEqual({ status: 'token', token: 'access-token' });
  });

  it('requests the API audience and API-only scopes', async () => {
    const getAccessTokenSilently = vi
      .fn<GetAccessTokenSilently>()
      .mockResolvedValue('access-token');
    const provider = createAuth0AccessTokenProvider(getAccessTokenSilently, AUDIENCE);

    await provider();

    expect(getAccessTokenSilently).toHaveBeenCalledWith({
      authorizationParams: { audience: AUDIENCE, scope: 'openid profile email' },
    });
  });

  it('forwards cacheMode without dropping the authorization params', async () => {
    const getAccessTokenSilently = vi
      .fn<GetAccessTokenSilently>()
      .mockResolvedValue('access-token');
    const provider = createAuth0AccessTokenProvider(getAccessTokenSilently, AUDIENCE);

    await provider({ cacheMode: 'off' });

    expect(getAccessTokenSilently).toHaveBeenCalledWith({
      authorizationParams: { audience: AUDIENCE, scope: 'openid profile email' },
      cacheMode: 'off',
    });
  });

  // auth0-spa-js >= 2.27 resolves to `undefined` once the session-expiry ceiling is
  // reached, instead of rejecting: the local session is already cleared by then.
  it('treats an undefined token as unauthenticated', async () => {
    const getAccessTokenSilently = vi.fn<GetAccessTokenSilently>().mockResolvedValue(undefined);
    const provider = createAuth0AccessTokenProvider(getAccessTokenSilently, AUDIENCE);

    await expect(provider()).resolves.toEqual({ status: 'unauthenticated' });
  });

  it.each(['login_required', 'invalid_token', 'invalid_grant', 'missing_refresh_token'])(
    'treats the %s error as unauthenticated',
    async code => {
      const getAccessTokenSilently = vi
        .fn<GetAccessTokenSilently>()
        .mockRejectedValue(auth0Error(code));
      const provider = createAuth0AccessTokenProvider(getAccessTokenSilently, AUDIENCE);

      await expect(provider()).resolves.toEqual({ status: 'unauthenticated' });
    },
  );

  it('surfaces transient failures as errors so the current token is preserved', async () => {
    const error = auth0Error('network_error', 'Failed to fetch');
    const getAccessTokenSilently = vi.fn<GetAccessTokenSilently>().mockRejectedValue(error);
    const provider = createAuth0AccessTokenProvider(getAccessTokenSilently, AUDIENCE);

    await expect(provider()).resolves.toEqual({ status: 'error', error });
  });

  it('surfaces errors without an Auth0 code as errors', async () => {
    const error = new Error('boom');
    const getAccessTokenSilently = vi.fn<GetAccessTokenSilently>().mockRejectedValue(error);
    const provider = createAuth0AccessTokenProvider(getAccessTokenSilently, AUDIENCE);

    await expect(provider()).resolves.toEqual({ status: 'error', error });
  });
});
