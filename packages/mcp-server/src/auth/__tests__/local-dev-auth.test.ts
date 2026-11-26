import { describe, expect, it, vi } from 'vitest';
import { EnvValidationError, parseEnv } from '../../config/env.js';
import { createUpstreamClient } from '../../upstream/default-client.js';
import {
  DEV_AUTH_HEADER,
  isLoopbackHostname,
  localDevPrincipal,
  withDevAuthHeader,
} from '../local-dev-auth.js';

const USER_ID = '1bb10fc7-90de-5fe9-9e2a-102fb80b9bee';

const localEnv: NodeJS.ProcessEnv = {
  MCP_PUBLIC_BASE_URL: 'http://localhost:3100',
  AUTH0_ISSUER_URL: 'https://tenant.auth0.com/',
  AUTH0_AUDIENCE: 'https://api.accounter.example',
  GRAPHQL_UPSTREAM_URL: 'http://localhost:4000/graphql',
  MCP_LOCAL_DEV_AUTH_USER_ID: USER_ID,
};

function refusalOf(env: NodeJS.ProcessEnv): string {
  try {
    parseEnv(env);
  } catch (error) {
    if (error instanceof EnvValidationError) return error.report;
    throw error;
  }
  return '';
}

describe('MCP_LOCAL_DEV_AUTH_USER_ID', () => {
  it('is off by default, and off when empty', () => {
    const { MCP_LOCAL_DEV_AUTH_USER_ID: _unset, ...withoutIt } = localEnv;
    expect(parseEnv(withoutIt).localDevAuth).toBeNull();
    expect(parseEnv({ ...localEnv, MCP_LOCAL_DEV_AUTH_USER_ID: '' }).localDevAuth).toBeNull();
  });

  it('turns on with a loopback upstream and public URL', () => {
    expect(parseEnv(localEnv).localDevAuth).toEqual({ userId: USER_ID });
    expect(
      parseEnv({
        ...localEnv,
        GRAPHQL_UPSTREAM_URL: 'http://127.0.0.1:4100/graphql',
        MCP_PUBLIC_BASE_URL: 'http://[::1]:3100',
      }).localDevAuth,
    ).toEqual({ userId: USER_ID });
  });

  it('is refused for a non-local upstream', () => {
    for (const upstream of [
      'https://accounter-api.example.com/graphql',
      'http://10.0.0.5:4000/graphql',
      'http://0.0.0.0:4000/graphql',
      'http://localhost.example.com/graphql',
    ]) {
      expect(refusalOf({ ...localEnv, GRAPHQL_UPSTREAM_URL: upstream }), upstream).toContain(
        'requires GRAPHQL_UPSTREAM_URL on a loopback host',
      );
    }
  });

  it('is refused for a non-local public base URL', () => {
    expect(refusalOf({ ...localEnv, MCP_PUBLIC_BASE_URL: 'https://mcp.example.com' })).toContain(
      'requires MCP_PUBLIC_BASE_URL on a loopback host',
    );
  });

  it('is refused under NODE_ENV=production', () => {
    expect(refusalOf({ ...localEnv, NODE_ENV: 'production' })).toContain(
      'cannot be set when NODE_ENV=production',
    );
  });

  it('must be a UUID', () => {
    expect(refusalOf({ ...localEnv, MCP_LOCAL_DEV_AUTH_USER_ID: 'dev-user' })).toContain(
      'MCP_LOCAL_DEV_AUTH_USER_ID must be a UUID',
    );
  });
});

describe('isLoopbackHostname', () => {
  it.each([
    ['localhost', true],
    ['LOCALHOST', true],
    ['app.localhost', true],
    ['127.0.0.1', true],
    ['127.10.0.3', true],
    ['[::1]', true],
    ['::1', true],
    ['0.0.0.0', false],
    ['localhost.example.com', false],
    ['10.0.0.1', false],
    ['example.com', false],
    ['', false],
  ])('%s → %s', (hostname, expected) => {
    expect(isLoopbackHostname(hostname)).toBe(expected);
  });
});

describe('localDevPrincipal', () => {
  it('names the user and carries no Auth0 issuer or scopes', () => {
    expect(localDevPrincipal(USER_ID)).toMatchObject({
      subject: USER_ID,
      issuer: 'local-dev-auth',
      scopes: [],
      email: null,
    });
  });
});

describe('X-Dev-Auth forwarding', () => {
  function recordingFetch() {
    const calls: Headers[] = [];
    const fetchImpl = vi.fn(async (_input: unknown, init?: RequestInit) => {
      calls.push(new Headers(init?.headers));
      return new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    return { calls, fetchImpl };
  }

  it('withDevAuthHeader sets X-Dev-Auth and drops Authorization', async () => {
    const { calls, fetchImpl } = recordingFetch();
    await withDevAuthHeader(USER_ID, fetchImpl)('http://localhost:4000/graphql', {
      headers: { Authorization: 'Bearer caller-token', 'X-Correlation-Id': 'corr-12345' },
    });

    expect(calls[0].get(DEV_AUTH_HEADER)).toBe(USER_ID);
    expect(calls[0].get('authorization')).toBeNull();
    expect(calls[0].get('x-correlation-id')).toBe('corr-12345');
  });

  it('the local-mode upstream client sends X-Dev-Auth instead of the bearer token', async () => {
    const { calls, fetchImpl } = recordingFetch();
    const client = createUpstreamClient(parseEnv(localEnv), fetchImpl);

    await client.query(
      { query: 'query Q { ok }' },
      { correlationId: 'corr-12345', authorization: 'Bearer caller-token' },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].get(DEV_AUTH_HEADER)).toBe(USER_ID);
    expect(calls[0].get('authorization')).toBeNull();
  });

  it('with the mode off, the client forwards the bearer token and no X-Dev-Auth', async () => {
    const { calls, fetchImpl } = recordingFetch();
    const { MCP_LOCAL_DEV_AUTH_USER_ID: _unset, ...withoutIt } = localEnv;
    const client = createUpstreamClient(parseEnv(withoutIt), fetchImpl);

    await client.query(
      { query: 'query Q { ok }' },
      { correlationId: 'corr-12345', authorization: 'Bearer caller-token' },
    );

    expect(calls[0].get('authorization')).toBe('Bearer caller-token');
    expect(calls[0].get(DEV_AUTH_HEADER)).toBeNull();
  });
});
