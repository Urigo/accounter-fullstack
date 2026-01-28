import { createSchema, createYoga } from 'graphql-yoga';
import { describe, expect, it } from 'vitest';
import { authPluginV2, type RawAuth } from '../auth-plugin-v2.js';

describe('authPluginV2', () => {
  const createTestYoga = () => {
    return createYoga({
      plugins: [authPluginV2()],
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
});
