import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    headersSent: false,
  } as unknown as ServerResponse & {
    writeHead: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
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

describe('requestHandler routing', () => {
  it('returns 404 for unknown paths', async () => {
    const res = mockRes();
    await requestHandler(mockReq({ method: 'GET', url: '/nope' }), res);
    expect(res.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith('{"error":"Not found"}');
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
