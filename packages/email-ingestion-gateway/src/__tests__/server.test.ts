import { describe, expect, it, vi } from 'vitest';
import type { ServerResponse } from 'node:http';

vi.mock('dotenv', () => ({ config: vi.fn() }));

const { routes, sendJson } = await import('../index.js');

describe('sendJson', () => {
  it('writes status code and JSON body', () => {
    const res = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;
    sendJson(res, 201, { id: 'abc' });
    expect(res.writeHead).toHaveBeenCalledWith(201, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith('{"id":"abc"}');
  });
});

describe('GET /health', () => {
  it('returns 200 with { status: "ok" }', () => {
    const res = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;
    routes.GET['/health']({} as never, res);
    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith('{"status":"ok"}');
  });
});

describe('unknown route', () => {
  it('is not present in the routes table', () => {
    expect(routes.GET['/unknown']).toBeUndefined();
    expect(routes.POST).toBeUndefined();
  });
});
