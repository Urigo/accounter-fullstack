import { ROUTES } from '../router/routes.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn(() => ({ mockClient: true }));
const mapExchangeMock = vi.fn(() => ({ mockMapExchange: true }));
const authExchangeMock = vi.fn();
type TestAccessTokenResult =
  | string
  | null
  | { status: 'token'; token: string }
  | { status: 'unauthenticated' }
  | { status: 'error'; error: unknown };

type TestAccessTokenProvider = (options?: { cacheMode?: 'on' | 'off' }) => Promise<TestAccessTokenResult>;

const appendHeadersMock = vi.fn((operation: any, headers: Record<string, string>) => ({
  ...operation,
  context: {
    ...(operation.context ?? {}),
    fetchOptions: {
      ...((operation.context?.fetchOptions as Record<string, unknown>) ?? {}),
      headers: {
        ...(((operation.context?.fetchOptions as { headers?: Record<string, string> })?.headers ??
          {}) as Record<string, string>),
        ...headers,
      },
    },
  },
}));

let authFactory:
  | ((utils: { appendHeaders: typeof appendHeadersMock }) => Promise<{
      addAuthToOperation: (operation: any) => any;
      didAuthError: (error: { graphQLErrors: Array<{ extensions?: { code?: string } | null }> }) => boolean;
      refreshAuth: () => Promise<void>;
      willAuthError: () => boolean;
    }>)
  | null = null;

vi.mock('urql', () => ({
  createClient: createClientMock,
  fetchExchange: { mockFetchExchange: true },
  mapExchange: mapExchangeMock,
  Provider: ({ children }: { children?: unknown }) => children,
}));

vi.mock('@urql/exchange-auth', () => ({
  authExchange: authExchangeMock.mockImplementation(
    (
      factory: (utils: { appendHeaders: typeof appendHeadersMock }) => Promise<{
        addAuthToOperation: (operation: any) => any;
        didAuthError: (error: { graphQLErrors: Array<{ extensions?: { code?: string } | null }> }) => boolean;
        refreshAuth: () => Promise<void>;
        willAuthError: () => boolean;
      }>,
    ) => {
      authFactory = factory;
      return { mockAuthExchange: true };
    },
  ),
}));

describe('URQL auth exchange hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authFactory = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function initializeAuth(
    provider?: TestAccessTokenProvider,
  ) {
    const urql = await import('../providers/urql.js');
    urql.resetUrqlClient();
    urql.setUrqlAccessTokenProvider(provider ?? null);
    urql.getUrqlClient();

    if (!authFactory) {
      throw new Error('authExchange factory was not captured in test setup');
    }

    return {
      urql,
      authConfig: await authFactory({ appendHeaders: appendHeadersMock }),
    };
  }

  it('adds Authorization header when token is available', async () => {
    const provider = vi.fn(async () => 'token-123');
    const { authConfig } = await initializeAuth(provider);

    const operation = { context: {} };
    const enrichedOperation = authConfig.addAuthToOperation(operation);

    expect(appendHeadersMock).toHaveBeenCalledWith(operation, {
      Authorization: 'Bearer token-123',
    });
    expect(enrichedOperation.context.fetchOptions.headers.Authorization).toBe('Bearer token-123');
  });

  it('detects only UNAUTHENTICATED GraphQL auth errors', async () => {
    const { authConfig } = await initializeAuth(async () => null);

    const unauthenticatedError = {
      graphQLErrors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
    };
    const forbiddenError = {
      graphQLErrors: [{ extensions: { code: 'FORBIDDEN' } }],
    };

    expect(authConfig.didAuthError(unauthenticatedError)).toBe(true);
    expect(authConfig.didAuthError(forbiddenError)).toBe(false);
  });

  it('does not eagerly trigger auth refresh before a server auth error', async () => {
    const { authConfig } = await initializeAuth(async () => null);

    expect(authConfig.willAuthError()).toBe(false);
  });

  it("refreshAuth forces a fresh token with cacheMode 'off'", async () => {
    const provider = vi
      .fn<TestAccessTokenProvider>()
      .mockResolvedValueOnce('cached-token')
      .mockResolvedValueOnce('fresh-token');

    const { authConfig } = await initializeAuth(provider);

    await authConfig.refreshAuth();

    expect(provider).toHaveBeenNthCalledWith(2, { cacheMode: 'off' });

    const operation = { context: {} };
    const refreshedOperation = authConfig.addAuthToOperation(operation);
    expect(refreshedOperation.context.fetchOptions.headers.Authorization).toBe('Bearer fresh-token');
  });

  it('redirects to /login when forced refresh reports unauthenticated', async () => {
    vi.stubGlobal('location', { href: 'http://localhost/' });

    const provider = vi
      .fn<TestAccessTokenProvider>()
      .mockResolvedValueOnce('initial-token')
      .mockResolvedValueOnce({ status: 'unauthenticated' });

    const { authConfig } = await initializeAuth(provider);

    await authConfig.refreshAuth();

    expect(globalThis.location.href).toBe(`${ROUTES.LOGIN}?reauth=1`);
  });

  it('redirects to /login?reauth=1 only once when repeated unauthenticated refresh attempts fail', async () => {
    vi.stubGlobal('location', { href: 'http://localhost/' });

    const provider = vi
      .fn<TestAccessTokenProvider>()
      .mockResolvedValueOnce('initial-token')
      .mockResolvedValueOnce({ status: 'unauthenticated' })
      .mockResolvedValueOnce({ status: 'unauthenticated' });

    const { authConfig } = await initializeAuth(provider);

    await authConfig.refreshAuth();
    await authConfig.refreshAuth();

    expect(globalThis.location.href).toBe(`${ROUTES.LOGIN}?reauth=1`);
  });

  it('does not redirect to login when forced refresh fails with a transient error', async () => {
    vi.stubGlobal('location', { href: 'http://localhost/' });

    const provider = vi
      .fn<TestAccessTokenProvider>()
      .mockResolvedValueOnce('initial-token')
      .mockRejectedValueOnce(new Error('network timeout'));

    const { authConfig } = await initializeAuth(provider);

    await expect(authConfig.refreshAuth()).rejects.toThrow('network timeout');
    expect(globalThis.location.href).toBe('http://localhost/');

    const operation = authConfig.addAuthToOperation({ context: {} });
    expect(operation.context.fetchOptions.headers.Authorization).toBe('Bearer initial-token');
  });

  it('silent refresh keeps in-flight requests using current token until refresh completes', async () => {
    let resolveRefresh: ((value: string | null) => void) | undefined;
    const refreshPromise = new Promise<string | null>(resolve => {
      resolveRefresh = resolve;
    });

    const provider = vi
      .fn<TestAccessTokenProvider>()
      .mockResolvedValueOnce('token-before-refresh')
      .mockImplementationOnce(() => refreshPromise);

    const { authConfig } = await initializeAuth(provider);

    const pendingRefresh = authConfig.refreshAuth();

    const inFlightOperation = authConfig.addAuthToOperation({ context: {} });
    expect(inFlightOperation.context.fetchOptions.headers.Authorization).toBe(
      'Bearer token-before-refresh',
    );

    resolveRefresh?.('token-after-refresh');
    await pendingRefresh;

    const postRefreshOperation = authConfig.addAuthToOperation({ context: {} });
    expect(postRefreshOperation.context.fetchOptions.headers.Authorization).toBe(
      'Bearer token-after-refresh',
    );
  });
});
