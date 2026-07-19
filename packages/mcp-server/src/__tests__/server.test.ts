import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROTECTED_RESOURCE_METADATA_PATH } from '../oauth/metadata.js';

// Silence structured log output during server tests.
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

const {
  routes,
  sendJson,
  requestHandler,
  getServiceVersion,
  createShutdownHandler,
  SERVICE_NAME,
} = await import('../server.js');

function mockRes(): ServerResponse & {
  writeHead: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
} {
  return {
    writeHead: vi.fn(),
    end: vi.fn(),
    setHeader: vi.fn(),
    once: vi.fn(),
    statusCode: 200,
    headersSent: false,
  } as unknown as ServerResponse & {
    writeHead: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
    once: ReturnType<typeof vi.fn>;
  };
}

function mockReq(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return { headers: {}, method: 'GET', url: '/', ...overrides } as unknown as IncomingMessage;
}

describe('sendJson', () => {
  it('writes status code and JSON body', () => {
    const res = mockRes();
    sendJson(res, 201, { id: 'abc' });
    expect(res.writeHead).toHaveBeenCalledWith(201, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith('{"id":"abc"}');
  });
});

describe('getServiceVersion', () => {
  it('returns the package version', () => {
    expect(getServiceVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('GET /health', () => {
  it('returns 200 with status, service, and version', async () => {
    const res = mockRes();
    await requestHandler(mockReq({ method: 'GET', url: '/health' }), res);

    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    const body = JSON.parse(res.end.mock.calls[0][0] as string);
    expect(body.status).toBe('ok');
    expect(body.service).toBe(SERVICE_NAME);
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(typeof body.uptimeSeconds).toBe('number');
  });

  it('is registered under GET routes', () => {
    expect(typeof routes.GET['/health']).toBe('function');
  });
});

describe('GET /.well-known/oauth-protected-resource', () => {
  it('returns 200 with the config-driven metadata document', async () => {
    process.env.MCP_PUBLIC_BASE_URL = 'https://mcp.example.com';
    process.env.AUTH0_ISSUER_URL = 'https://tenant.auth0.com/';
    process.env.AUTH0_AUDIENCE = 'aud';
    process.env.GRAPHQL_UPSTREAM_URL = 'http://localhost:4000/graphql';
    const { resetEnvCache } = await import('../config/env.js');
    resetEnvCache();

    const res = mockRes();
    await requestHandler(mockReq({ method: 'GET', url: PROTECTED_RESOURCE_METADATA_PATH }), res);

    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    const body = JSON.parse(res.end.mock.calls.at(-1)?.[0] as string);
    expect(body.resource).toBe('https://mcp.example.com');
    expect(body.authorization_servers).toEqual(['https://tenant.auth0.com/']);
    expect(body.bearer_methods_supported).toEqual(['header']);

    resetEnvCache();
  });
});

describe('requestHandler routing', () => {
  it('returns 404 for unknown paths', async () => {
    const res = mockRes();
    await requestHandler(mockReq({ method: 'GET', url: '/nope' }), res);
    expect(res.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith('{"error":"Not found"}');
  });

  it('sets an X-Correlation-Id response header', async () => {
    const res = mockRes();
    await requestHandler(mockReq({ method: 'GET', url: '/health' }), res);
    const call = res.setHeader.mock.calls.find(([name]) => name === 'X-Correlation-Id');
    expect(call).toBeDefined();
    expect(typeof call?.[1]).toBe('string');
  });

  it('reuses an inbound correlation id', async () => {
    const res = mockRes();
    await requestHandler(
      mockReq({ method: 'GET', url: '/health', headers: { 'x-correlation-id': 'trace-123' } }),
      res,
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-Id', 'trace-123');
  });

  it('returns 404 for unsupported methods on a known path', async () => {
    const res = mockRes();
    await requestHandler(mockReq({ method: 'POST', url: '/health' }), res);
    expect(res.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
  });

  it('returns 500 when a handler throws', async () => {
    const res = mockRes();
    const throwingReq = mockReq({ method: 'GET', url: '/health' });
    // Force sendJson's first write to throw by making writeHead throw once.
    (res.writeHead as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(() => {
        throw new Error('boom');
      })
      .mockImplementation(() => {});
    await requestHandler(throwingReq, res);
    // Second writeHead call is the 500 fallback.
    expect(res.writeHead).toHaveBeenLastCalledWith(500, { 'Content-Type': 'application/json' });
  });
});

describe('createShutdownHandler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('closes the server and exits 0 on clean shutdown', () => {
    const exit = vi.fn();
    const server = {
      close: vi.fn((cb: (err?: Error) => void) => cb()),
    } as unknown as Server;

    const handler = createShutdownHandler({ server, exit, graceMs: 1000 });
    handler('SIGTERM');

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('closes idle keep-alive connections to avoid stalling shutdown', () => {
    const exit = vi.fn();
    const closeIdleConnections = vi.fn();
    const server = {
      close: vi.fn((cb: (err?: Error) => void) => cb()),
      closeIdleConnections,
    } as unknown as Server;

    const handler = createShutdownHandler({ server, exit, graceMs: 1000 });
    handler('SIGTERM');

    expect(closeIdleConnections).toHaveBeenCalledTimes(1);
  });

  it('exits 1 when close reports an error', () => {
    const exit = vi.fn();
    const server = {
      close: vi.fn((cb: (err?: Error) => void) => cb(new Error('close failed'))),
    } as unknown as Server;

    const handler = createShutdownHandler({ server, exit, graceMs: 1000 });
    handler('SIGINT');

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('ignores repeated signals (idempotent)', () => {
    const exit = vi.fn();
    const close = vi.fn((_cb: (err?: Error) => void) => {
      /* never calls back */
    });
    const server = { close } as unknown as Server;

    const handler = createShutdownHandler({ server, exit, graceMs: 1000 });
    handler('SIGTERM');
    handler('SIGTERM');

    expect(close).toHaveBeenCalledTimes(1);
  });
});
