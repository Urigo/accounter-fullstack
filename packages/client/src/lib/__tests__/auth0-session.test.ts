// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearStoredAuth0Session,
  getStoredAuth0AccessToken,
  hasStoredAuth0Session,
} from '../auth0-session.js';

describe('auth0-session utilities', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_AUTH0_FRONTEND_CLIENT_ID', 'test-client-id');
    vi.stubEnv('VITE_AUTH0_AUDIENCE', 'test-audience');
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('clears Auth0 SPA SDK cache and auth marker keys', () => {
    localStorage.setItem('@@auth0spajs@@::client::audience::scope', '{"access_token":"abc"}');
    localStorage.setItem('a0.spajs.txs.123', '{"state":"value"}');
    localStorage.setItem('auth0.is.authenticated', 'true');
    localStorage.setItem('other:key', 'keep-me');

    clearStoredAuth0Session();

    expect(localStorage.getItem('@@auth0spajs@@::client::audience::scope')).toBeNull();
    expect(localStorage.getItem('a0.spajs.txs.123')).toBeNull();
    expect(localStorage.getItem('auth0.is.authenticated')).toBeNull();
    expect(localStorage.getItem('other:key')).toBe('keep-me');
  });

  it('returns false for session after cleanup', () => {
    const clientId = import.meta.env.VITE_AUTH0_FRONTEND_CLIENT_ID;
    const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
    const scope = 'openid profile email offline_access';

    localStorage.setItem(
      `@@auth0spajs@@::${clientId}::${audience}::${scope}`,
      JSON.stringify({ access_token: 'token-1' }),
    );

    expect(getStoredAuth0AccessToken()).toBe('token-1');
    expect(hasStoredAuth0Session()).toBe(true);

    clearStoredAuth0Session();

    expect(getStoredAuth0AccessToken()).toBeNull();
    expect(hasStoredAuth0Session()).toBe(false);
  });
  it('reports no session when the browser blocks storage access', () => {
    // Private windows and "block all cookies" make the accessor itself throw.
    // LandingRoute calls this during render, so a throw here would take the
    // public landing page down for the visitors it exists to serve.
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });

    expect(() => getStoredAuth0AccessToken()).not.toThrow();
    expect(getStoredAuth0AccessToken()).toBeNull();
    expect(hasStoredAuth0Session()).toBe(false);

    getItem.mockRestore();
  });

  it('reports no session when enumerating storage throws', () => {
    const length = vi.spyOn(Storage.prototype, 'length', 'get').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });

    expect(hasStoredAuth0Session()).toBe(false);

    length.mockRestore();
  });
});
