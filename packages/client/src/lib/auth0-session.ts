const AUTH0_SCOPE = 'openid profile email';

function buildAuth0CachePrefix(clientId: string, audience: string): string {
  return `@@auth0spajs@@::${clientId}::${audience}::`;
}

function parseAuth0CacheEntry(rawValue: string): string | null {
  try {
    const parsed = JSON.parse(rawValue) as {
      access_token?: string;
      body?: { access_token?: string };
    } | null;

    return parsed?.access_token ?? parsed?.body?.access_token ?? null;
  } catch {
    return null;
  }
}

export function getStoredAuth0AccessToken(): string | null {
  // NOTE: Prefer `useAuth0().getAccessTokenSilently()` in React code.
  // This helper exists for non-React contexts where hooks are unavailable
  // (for example, modules that run outside component trees). It inspects
  // Auth0 SPA SDK localStorage cache keys/values, which are internal details
  // and not part of Auth0's public API. Future SDK changes can break this.
  const clientId = import.meta.env.VITE_AUTH0_FRONTEND_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  if (!clientId || !audience) {
    return null;
  }

  const exactCacheKey = `@@auth0spajs@@::${clientId}::${audience}::${AUTH0_SCOPE}`;
  const exactValue = localStorage.getItem(exactCacheKey);
  if (exactValue) {
    const token = parseAuth0CacheEntry(exactValue);
    if (token) {
      return token;
    }
  }

  const prefix = buildAuth0CachePrefix(clientId, audience);
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) {
      continue;
    }

    const rawValue = localStorage.getItem(key);
    if (!rawValue) {
      continue;
    }

    const token = parseAuth0CacheEntry(rawValue);
    if (token) {
      return token;
    }
  }

  return null;
}

export function hasStoredAuth0Session(): boolean {
  return !!getStoredAuth0AccessToken();
}

export function clearStoredAuth0Session(): void {
  try {
    const auth0KeyPrefixes = ['@@auth0spajs@@', 'a0.spajs.txs'];
    const exactKeys = ['auth0.is.authenticated'];
    Object.keys(localStorage)
      .filter(
        key => exactKeys.includes(key) || auth0KeyPrefixes.some(prefix => key.startsWith(prefix)),
      )
      .map(key => localStorage.removeItem(key));
  } catch {
    // Ignore storage access errors (e.g., blocked localStorage) to avoid breaking login flow.
  }
}
