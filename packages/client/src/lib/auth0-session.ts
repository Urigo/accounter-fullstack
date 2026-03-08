const AUTH0_SCOPE = 'openid profile email offline_access';

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
