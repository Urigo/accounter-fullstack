import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createSchema, createYoga } from 'graphql-yoga';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { requestLogPlugin } from '../../plugins/request-log-plugin.js';
import type { AccounterContext } from '../../shared/types/index.js';
import {
  attachRequestLog,
  logContextFields,
  withLogContext,
  withoutLogContext,
} from '../log-context.js';
import { createYogaLogger, log, setLogContextProvider, type LogFields } from '../log.js';

const schema = createSchema<AccounterContext>({
  typeDefs: /* GraphQL */ `
    type Query {
      hello: String
      slow: String
    }
  `,
  resolvers: {
    Query: {
      // What AuthContextProvider does once auth resolves, then a line from deeper down.
      hello: (_parent, _args, context) => {
        context.requestLog!.userId = 'user-1';
        log('info', 'inside-resolver');
        return 'world';
      },
      // Runs after the first payload of a `@defer`red response has been sent.
      slow: async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        log('info', 'inside-deferred-resolver');
        return 'late';
      },
    },
  },
});

let lines: LogFields[] = [];

beforeEach(() => {
  lines = [];
  setLogContextProvider(logContextFields);
  vi.spyOn(process.stdout, 'write').mockImplementation(chunk => {
    lines.push(JSON.parse(String(chunk)) as LogFields);
    return true;
  });
});

afterEach(() => {
  setLogContextProvider();
  vi.restoreAllMocks();
});

const byMsg = (msg: string) => lines.filter(line => line['msg'] === msg);

describe('log context outside a request', () => {
  it('adds nothing', () => {
    log('info', 'no-request');
    expect(byMsg('no-request')[0]).not.toHaveProperty('requestId');
  });

  it('adds nothing inside withoutLogContext', () => {
    withLogContext(() => {
      attachRequestLog({ requestId: 'req-1' } as never);
      withoutLogContext(() => log('info', 'detached'));
      log('info', 'attached');
    });
    expect(byMsg('detached')[0]).not.toHaveProperty('requestId');
    expect(byMsg('attached')[0]).toMatchObject({ requestId: 'req-1' });
  });
});

describe('log context through the HTTP server', () => {
  const yoga = createYoga({
    schema,
    logging: createYogaLogger(),
    plugins: [requestLogPlugin(), useDeferStream()],
  });
  let server: Server;
  let url: string;
  let connections = 0;

  beforeAll(async () => {
    // As in `index.ts`.
    server = createServer((req, res) => withLogContext(() => yoga(req, res)));
    server.on('connection', () => {
      connections += 1;
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/graphql`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });

  const post = async (query: string, requestId: string, accept = 'application/json') => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept, 'x-request-id': requestId },
      body: JSON.stringify({ query }),
    });
    return response.text();
  };

  it("tags a resolver's line with its request's ids", async () => {
    await post('query Greeting { hello }', 'req-hello-1');

    expect(byMsg('inside-resolver')).toEqual([
      expect.objectContaining({
        requestId: 'req-hello-1',
        operationName: 'Greeting',
        userId: 'user-1',
      }),
    ]);
    expect(byMsg('inside-resolver')[0]).not.toHaveProperty('businessId');
  });

  it('keeps the context in a @defer-red field after the first payload', async () => {
    const body = await post(
      'query Deferred { hello ... @defer { slow } }',
      'req-defer-1',
      'multipart/mixed',
    );

    expect(body).toContain('late');
    expect(byMsg('inside-deferred-resolver')).toEqual([
      expect.objectContaining({ requestId: 'req-defer-1', operationName: 'Deferred' }),
    ]);
  });

  it('gives each request on a kept-alive connection its own ids', async () => {
    const before = connections;
    await post('query First { hello }', 'req-first-1');
    await post('query Second { hello }', 'req-second-1');

    expect(connections - before).toBeLessThanOrEqual(1);
    expect(byMsg('inside-resolver').map(line => [line['requestId'], line['operationName']])).toEqual(
      [
        ['req-first-1', 'First'],
        ['req-second-1', 'Second'],
      ],
    );
  });
});
