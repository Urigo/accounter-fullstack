import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';

vi.mock('dotenv', () => ({ config: vi.fn() }));
// Silence structured log output in server tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

const { routes, sendJson, requestHandler } = await import('../index.js');

function mockRes(): ServerResponse {
  return {
    writeHead: vi.fn(),
    end: vi.fn(),
    setHeader: vi.fn(),
  } as unknown as ServerResponse;
}

function mockReq(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return { headers: {}, ...overrides } as unknown as IncomingMessage;
}

// ---------------------------------------------------------------------------
// sendJson
// ---------------------------------------------------------------------------

describe('sendJson', () => {
  it('writes status code and JSON body', () => {
    const res = mockRes();
    sendJson(res, 201, { id: 'abc' });
    expect(res.writeHead).toHaveBeenCalledWith(201, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith('{"id":"abc"}');
  });
});

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 with { status: "ok" }', () => {
    const res = mockRes();
    routes.GET['/health']({} as never, res);
    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith('{"status":"ok"}');
  });
});

describe('GET /readiness', () => {
  it('returns 200 with { ready: true }', () => {
    const res = mockRes();
    routes.GET['/readiness']({} as never, res);
    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith('{"ready":true}');
  });
});

describe('unknown route', () => {
  it('is not present in the routes table', () => {
    expect(routes.GET['/unknown']).toBeUndefined();
    expect(routes.POST['/unknown']).toBeUndefined();
  });
});

describe('POST /webhook', () => {
  it('is registered in the routes table', () => {
    expect(typeof routes.POST['/webhook']).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// requestHandler — correlation ID and routing
// ---------------------------------------------------------------------------

describe('requestHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets X-Correlation-Id response header', async () => {
    const res = mockRes();
    await requestHandler(mockReq({ url: '/health', method: 'GET' }), res);
    expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-Id', expect.any(String));
  });

  it('propagates X-Correlation-Id from request header', async () => {
    const res = mockRes();
    await requestHandler(
      mockReq({ url: '/health', method: 'GET', headers: { 'x-correlation-id': 'my-id' } }),
      res,
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-Id', 'my-id');
  });

  it('returns 404 for unknown routes', async () => {
    const res = mockRes();
    await requestHandler(mockReq({ url: '/unknown', method: 'GET' }), res);
    expect(res.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith('{"error":"Not found"}');
  });

  it('returns 500 and logs error when URL parsing throws', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    const res = mockRes();
    // An incomplete IPv6 literal causes new URL() to throw TypeError
    await requestHandler(mockReq({ url: 'http://[', method: 'GET' }), res);
    expect(res.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith('{"error":"Internal server error"}');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns 500 when a route handler throws', async () => {
    routes.GET['/throw-test'] = () => {
      throw new Error('handler exploded');
    };
    const res = mockRes();
    await requestHandler(mockReq({ url: '/throw-test', method: 'GET' }), res);
    expect(res.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
    delete routes.GET['/throw-test'];
  });
});
