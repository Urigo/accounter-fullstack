import type { FastifyInstance } from 'fastify';
import type { VaultStatusResponse } from '../shared/types.js';
import { registerAccountsRoutes } from './accounts-routes.js';
import { isRunning } from './scrape-runner.js';
import { registerSettingsRoutes } from './settings-routes.js';
import { registerSourcesRoutes } from './sources-routes.js';
import {
  closeVault,
  createVault,
  exportVault,
  getChanges,
  getSessionInfo,
  getVault,
  isCurrentSession,
  isLocked,
  markSaved,
  openVault,
} from './vault-store.js';

type OpenBody = { blob: string; password: string; fileName?: string };
type CreateBody = { password: string; serverUrl: string; apiKey: string };
type ExportBody = { sessionId: string };
type CloseBody = { sessionId: string; discardChanges?: boolean };
type SavedBody = { sessionId: string; revision: number; fileName?: string };

const STALE_SESSION = { error: 'session-changed' };

export async function registerVaultRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/vault/status', async (): Promise<VaultStatusResponse> => {
    if (isLocked()) return { state: 'empty' };
    return { state: 'unlocked', ...getSessionInfo(), changes: getChanges() };
  });

  // The vault file never touches this machine's disk: the browser sends its contents (already
  // base64 text) and the server keeps the decrypted vault in memory for the session.
  app.post<{ Body: OpenBody }>(
    '/api/vault/open',
    {
      bodyLimit: 10 * 1024 * 1024,
      schema: {
        body: {
          type: 'object',
          required: ['blob', 'password'],
          properties: {
            blob: { type: 'string' },
            password: { type: 'string' },
            fileName: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const { blob, password, fileName } = req.body;
      const result = await openVault(blob, password, fileName ?? '');
      if (result === 'ok') return { ok: true, sessionId: getSessionInfo().sessionId };
      if (result === 'already-open') return reply.status(409).send({ error: 'vault-already-open' });
      const status = result === 'wrong-password' ? 401 : 400;
      return reply.status(status).send({ error: result });
    },
  );

  app.post<{ Body: CreateBody }>(
    '/api/vault/create',
    {
      schema: {
        body: {
          type: 'object',
          required: ['password', 'serverUrl', 'apiKey'],
          properties: {
            password: { type: 'string' },
            serverUrl: { type: 'string' },
            apiKey: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const { password, serverUrl, apiKey } = req.body;
      if (!createVault(password, serverUrl, apiKey)) {
        return reply.status(409).send({ error: 'vault-already-open' });
      }
      return reply.status(201).send({ ok: true, sessionId: getSessionInfo().sessionId });
    },
  );

  app.get('/api/vault/changes', async (_req, reply) => {
    if (isLocked()) return reply.status(401).send({ error: 'vault-locked' });
    return getChanges();
  });

  // Both export and saved name the session the client is saving for. A tab holding a file handle
  // from a session that has since been closed (say, in another tab) must not write a different
  // vault into that file.
  const sessionBody = {
    type: 'object',
    required: ['sessionId'],
    properties: { sessionId: { type: 'string' } },
  } as const;

  app.post<{ Body: ExportBody }>(
    '/api/vault/export',
    { schema: { body: sessionBody } },
    async (req, reply) => {
      if (isLocked()) return reply.status(401).send({ error: 'vault-locked' });
      if (!isCurrentSession(req.body.sessionId)) return reply.status(409).send(STALE_SESSION);
      return exportVault();
    },
  );

  app.post<{ Body: SavedBody }>(
    '/api/vault/saved',
    {
      schema: {
        body: {
          type: 'object',
          required: ['sessionId', 'revision'],
          properties: {
            sessionId: { type: 'string' },
            revision: { type: 'integer' },
            fileName: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (isLocked()) return reply.status(401).send({ error: 'vault-locked' });
      if (!isCurrentSession(req.body.sessionId)) return reply.status(409).send(STALE_SESSION);
      // The baseline becomes exactly what was exported, so edits made while the save dialog was
      // open still show as unsaved. A revision that was never exported is ignored.
      const ok = markSaved(req.body.revision, req.body.fileName);
      return { ok, changes: getChanges() };
    },
  );

  app.post<{ Body: CloseBody }>(
    '/api/vault/close',
    {
      schema: {
        body: {
          type: 'object',
          required: ['sessionId'],
          properties: { sessionId: { type: 'string' }, discardChanges: { type: 'boolean' } },
        },
      },
    },
    async (req, reply) => {
      if (isLocked()) return { ok: true };
      // A tab left over from a vault closed elsewhere must not close the one open now.
      if (!isCurrentSession(req.body.sessionId)) return reply.status(409).send(STALE_SESSION);
      // A running scrape reads and updates the vault (account discovery). Closing under it would
      // fail the run, or write its accounts into whichever vault is opened next.
      if (isRunning()) return reply.status(409).send({ error: 'run-in-progress' });
      // Checked here rather than trusted from the tab: another tab may have just made changes.
      if (getChanges().dirty && !req.body.discardChanges) {
        return reply.status(409).send({ error: 'unsaved-changes' });
      }
      closeVault();
      return { ok: true };
    },
  );

  app.get('/api/vault/test-connection', async (_req, reply) => {
    if (isLocked()) return reply.status(401).send({ error: 'vault-locked' });
    const { serverUrl, apiKey } = getVault().settings;
    if (!serverUrl || !apiKey) {
      return reply.status(400).send({ error: 'Server URL and API key are not configured' });
    }
    const t0 = Date.now();
    try {
      // Probe with the same header the upload client sends (see graphql/client.ts).
      // The server takes the scraper key from `x-api-key`; an `Authorization: Bearer`
      // header is claimed first and routed to JWT verification, so probing with Bearer
      // would test a different code path than the one uploads actually use.
      const res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ query: '{ __typename }' }),
        signal: AbortSignal.timeout(10_000),
      });
      const latencyMs = Date.now() - t0;
      const text = await res.text().catch(() => '');
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}: ${text || res.statusText}`, latencyMs };
      }

      // A 2xx is not enough: anything serving a SPA answers an unknown path with
      // index.html and a 200. Only a parseable GraphQL result proves this URL is
      // really the Accounter endpoint.
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return {
          ok: false,
          error:
            `${serverUrl} did not return JSON — it is probably not the Accounter GraphQL ` +
            `endpoint. The URL must include the path, e.g. http://localhost:4000/graphql`,
          latencyMs,
        };
      }

      const body = parsed as {
        data?: { __typename?: unknown } | null;
        errors?: { message?: string }[] | null;
      } | null;
      const gqlError = body?.errors?.[0]?.message;
      if (gqlError) {
        return { ok: false, error: gqlError, latencyMs };
      }
      if (typeof body?.data?.__typename !== 'string') {
        return { ok: false, error: `${serverUrl} did not return a GraphQL result`, latencyMs };
      }
      return { ok: true, latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - t0;
      return { ok: false, error: err instanceof Error ? err.message : String(err), latencyMs };
    }
  });

  await registerSourcesRoutes(app);
  await registerSettingsRoutes(app);
  await registerAccountsRoutes(app);
}
