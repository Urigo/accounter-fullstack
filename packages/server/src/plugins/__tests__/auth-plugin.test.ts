import { createSchema, createYoga } from 'graphql-yoga';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authPlugin, type RawAuth } from '../auth-plugin.js';
import { handleDevBypassAuth } from '../../modules/auth/providers/auth-context.provider.js';

vi.mock('../../modules/auth/providers/auth-context.provider.js', () => ({
  handleDevBypassAuth: vi.fn(),
}));

describe('authPlugin', () => {
  const originalAllowDevAuth = process.env.ALLOW_DEV_AUTH;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ALLOW_DEV_AUTH;
  });

  afterEach(() => {
    if (originalAllowDevAuth === undefined) {
      delete process.env.ALLOW_DEV_AUTH;
    } else {
      process.env.ALLOW_DEV_AUTH = originalAllowDevAuth;
    }
  });

  const createTestYoga = () => {
    const mockPool = {
      query: vi.fn(),
    };

    return createYoga({
      plugins: [authPlugin()],
      schema: createSchema({
        typeDefs: `type Query { test: String }`,
        resolvers: {
          Query: {
            test: (_: unknown, __: unknown, context: { rawAuth: RawAuth }) => {
              return JSON.stringify(context.rawAuth);
            },
          },
        },
      }),
      context: ({ request }) => ({
        request,
        pool: mockPool,
      }),
    });
  };

  it('should extract JWT token from Authorization header', async () => {
    const yoga = createTestYoga();
    const token = 'valid.jwt.token';

    const response = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: '{ test }' }),
    });

    const result = await response.json();
    const rawAuth = JSON.parse(result.data.test);

    expect(rawAuth).toEqual({
      authType: 'jwt',
      token,
    });
  });

  it('should extract API key from X-API-Key header', async () => {
    const yoga = createTestYoga();
    const key = 'active-api-key';

    const response = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': key,
      },
      body: JSON.stringify({ query: '{ test }' }),
    });

    const result = await response.json();
    const rawAuth = JSON.parse(result.data.test);

    expect(rawAuth).toEqual({
      authType: 'apiKey',
      token: key,
    });
  });

  it('should prioritize JWT when both headers are present', async () => {
    const yoga = createTestYoga();
    const token = 'jwt.token.priority';
    const key = 'ignored-api-key';

    const response = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-API-Key': key,
      },
      body: JSON.stringify({ query: '{ test }' }),
    });

    const result = await response.json();
    const rawAuth = JSON.parse(result.data.test);

    expect(rawAuth).toEqual({
      authType: 'jwt',
      token,
    });
  });

  it('should return null auth for missing headers', async () => {
    const yoga = createTestYoga();

    const response = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: '{ test }' }),
    });

    const result = await response.json();
    const rawAuth = JSON.parse(result.data.test);

    expect(rawAuth).toEqual({
      authType: null,
      token: null,
    });
  });

  it('should iterate gracefully on malformed Authorization header', async () => {
    const yoga = createTestYoga();

    const response = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic somecreds',
      },
      body: JSON.stringify({ query: '{ test }' }),
    });

    const result = await response.json();
    const rawAuth = JSON.parse(result.data.test);

    // Should return null unless X-API-Key is also present (checked in logic)
    expect(rawAuth).toEqual({
      authType: null,
      token: null,
    });
  });

  it('should handle empty tokens as null', async () => {
    const yoga = createTestYoga();

    const response = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ', // Empty token part
        'X-API-Key': '   ', // Whitespace only
      },
      body: JSON.stringify({ query: '{ test }' }),
    });

    const result = await response.json();
    const rawAuth = JSON.parse(result.data.test);

    expect(rawAuth).toEqual({
      authType: null,
      token: null,
    });
  });

  it('should ignore X-Dev-Auth when ALLOW_DEV_AUTH is missing', async () => {
    vi.mocked(handleDevBypassAuth).mockResolvedValue({
      authType: 'devBypass',
      token: 'dev-user',
      tenant: { businessId: 'biz-1' },
      user: {
        userId: 'dev-user',
        email: 'dev-user',
        roleId: 'business_owner',
        permissions: [],
        emailVerified: true,
        permissionsVersion: 0,
      },
    });

    const yoga = createTestYoga();

    const response = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dev-Auth': 'dev-user',
      },
      body: JSON.stringify({ query: '{ test }' }),
    });

    const result = await response.json();
    const rawAuth = JSON.parse(result.data.test);

    expect(handleDevBypassAuth).not.toHaveBeenCalled();
    expect(rawAuth).toEqual({
      authType: null,
      token: null,
    });
  });

  it('should ignore X-Dev-Auth when ALLOW_DEV_AUTH is false', async () => {
    process.env.ALLOW_DEV_AUTH = '0';
    const yoga = createTestYoga();

    const response = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dev-Auth': 'dev-user',
        'X-API-Key': 'fallback-key',
      },
      body: JSON.stringify({ query: '{ test }' }),
    });

    const result = await response.json();
    const rawAuth = JSON.parse(result.data.test);

    expect(handleDevBypassAuth).not.toHaveBeenCalled();
    expect(rawAuth).toEqual({
      authType: 'apiKey',
      token: 'fallback-key',
    });
  });

  it('should call handleDevBypassAuth when ALLOW_DEV_AUTH=1 and X-Dev-Auth is present', async () => {
    process.env.ALLOW_DEV_AUTH = '1';
    vi.mocked(handleDevBypassAuth).mockResolvedValue({
      authType: 'devBypass',
      token: 'dev-user',
      tenant: { businessId: 'biz-1' },
      user: {
        userId: 'dev-user',
        email: 'dev-user',
        roleId: 'business_owner',
        permissions: [],
        emailVerified: true,
        permissionsVersion: 0,
      },
    });

    const yoga = createTestYoga();

    const response = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dev-Auth': 'dev-user',
        Authorization: 'Bearer ignored.jwt.token',
      },
      body: JSON.stringify({ query: '{ test }' }),
    });

    const result = await response.json();
    const rawAuth = JSON.parse(result.data.test);

    expect(handleDevBypassAuth).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.any(Function) }),
      'dev-user',
    );
    expect(rawAuth).toEqual({
      authType: 'devBypass',
      token: 'dev-user',
    });
  });
});
