import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../index.js';

let app: FastifyInstance;

beforeEach(async () => {
  app = await buildServer();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('GET /healthz', () => {
  it('returns 200 with { ok: true }', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
