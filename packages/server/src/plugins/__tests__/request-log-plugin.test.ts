import { GraphQLError } from 'graphql';
import { createSchema, createYoga, useExtendContext } from 'graphql-yoga';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { createYogaLogger, markLogged } from '../../observability/log.js';
import type { AccounterContext } from '../../shared/types/index.js';
import { ERROR_LOG_MSG, OPERATION_LOG_MSG, requestLogPlugin } from '../request-log-plugin.js';

const schema = createSchema<AccounterContext>({
  typeDefs: /* GraphQL */ `
    type Query {
      hello: String
      boom: String
      forbidden: String
      also: String
      slow: String
      slowForbidden: String
      upstream: String
      deliberateFault: String
      whoAmI: String
    }
  `,
  resolvers: {
    Query: {
      hello: () => 'world',
      boom: () => {
        throw new Error('database exploded', { cause: new Error('connection reset') });
      },
      forbidden: () => {
        throw new GraphQLError('Not allowed', { extensions: { code: 'FORBIDDEN' } });
      },
      also: () => {
        throw new GraphQLError('Not allowed', { extensions: { code: 'FORBIDDEN' } });
      },
      slow: async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        throw new Error('deferred failure');
      },
      slowForbidden: async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        throw new GraphQLError('Not allowed', { extensions: { code: 'FORBIDDEN' } });
      },
      // A failure a lower boundary already logged in full, as GreenInvoiceClientProvider does.
      // A server fault reported on purpose: passed through to the client, but still a fault.
      deliberateFault: () => {
        throw new GraphQLError('Failed to create the onboarding business', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      },
      upstream: () => {
        const error = new Error('Green Invoice Update Client error: Invalid tax id');
        markLogged(error);
        throw error;
      },
      // What AuthContextProvider does once auth resolves.
      whoAmI: (_parent, _args, context) => {
        context.requestLog!.userId = 'user-1';
        context.requestLog!.businessId = 'business-1';
        return 'me';
      },
    },
  },
});

function yoga(extraPlugins: Parameters<typeof createYoga>[0]['plugins'] = []) {
  return createYoga({
    schema,
    logging: createYogaLogger(),
    plugins: [requestLogPlugin(), useDeferStream(), ...(extraPlugins ?? [])],
  });
}

async function post(
  server: ReturnType<typeof yoga>,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  const response = await server.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return response.text();
}

let stdout: MockInstance;
let stderr: MockInstance;

beforeEach(() => {
  stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Every line written to stdout and stderr; asserts each one is a single JSON record. */
function records(): Array<Record<string, unknown>> {
  return [...stdout.mock.calls, ...stderr.mock.calls].map(([chunk]) => {
    const line = String(chunk);
    expect(line.endsWith('\n')).toBe(true);
    expect(line.slice(0, -1)).not.toContain('\n');
    return JSON.parse(line) as Record<string, unknown>;
  });
}

const byMsg = (msg: string) => records().filter(record => record['msg'] === msg);

describe('requestLogPlugin', () => {
  it('writes exactly one graphql-operation line for a successful operation', async () => {
    await post(yoga(), { query: 'query Greeting { hello }' }, { 'x-request-id': 'req-abc-001' });

    expect(byMsg(OPERATION_LOG_MSG)).toEqual([
      {
        msg: OPERATION_LOG_MSG,
        level: 'info',
        time: expect.any(String),
        operationName: 'Greeting',
        operationType: 'query',
        durationMs: expect.any(Number),
        errorCount: 0,
        errorCodes: [],
        aborted: false,
        userId: null,
        businessId: null,
        requestId: 'req-abc-001',
        correlationId: null,
      },
    ]);
    expect(byMsg(ERROR_LOG_MSG)).toEqual([]);
  });

  it('logs the correlation id as its own field, not as the request id', async () => {
    // The MCP server sends one correlation id on every upstream call of a tool run, retries
    // included: each of those requests still needs its own request id.
    await post(yoga(), { query: '{ hello }' }, { 'x-correlation-id': 'corr-0001' });
    await post(yoga(), { query: '{ hello }' }, { 'x-correlation-id': 'corr-0001' });

    const lines = byMsg(OPERATION_LOG_MSG);
    expect(lines).toEqual([
      expect.objectContaining({ correlationId: 'corr-0001' }),
      expect.objectContaining({ correlationId: 'corr-0001' }),
    ]);
    expect(lines[0]['requestId']).not.toBe('corr-0001');
    expect(lines[0]['requestId']).not.toBe(lines[1]['requestId']);
  });

  it('records the user and business set once auth resolved', async () => {
    await post(yoga(), { query: '{ whoAmI }' });

    expect(byMsg(OPERATION_LOG_MSG)).toEqual([
      expect.objectContaining({ operationName: null, userId: 'user-1', businessId: 'business-1' }),
    ]);
  });

  it('logs an unexpected error unmasked, with the operation, and once only', async () => {
    const body = await post(yoga(), { query: 'query Report { boom }' });

    // The client still gets the masked error.
    expect(body).toContain('Unexpected error.');
    expect(body).not.toContain('database exploded');

    expect(byMsg(OPERATION_LOG_MSG)).toEqual([
      expect.objectContaining({
        operationName: 'Report',
        errorCount: 1,
        errorCodes: ['INTERNAL_SERVER_ERROR'],
      }),
    ]);
    const errors = byMsg(ERROR_LOG_MSG);
    expect(errors).toEqual([
      expect.objectContaining({
        level: 'error',
        operationName: 'Report',
        message: 'database exploded',
        code: 'INTERNAL_SERVER_ERROR',
        path: 'boom',
        error: expect.objectContaining({
          message: 'database exploded',
          stack: expect.any(String),
          cause: expect.objectContaining({ message: 'connection reset' }),
        }),
      }),
    ]);
    // Yoga logs every error it masks; that line is skipped, as this error was already logged.
    const mentions = records().filter(record => JSON.stringify(record).includes('database exploded'));
    expect(mentions).toHaveLength(1);
  });

  it('logs a repeated expected error once per operation, with a count', async () => {
    const body = await post(yoga(), { query: 'query Guarded { forbidden also hello }' });

    expect(body).toContain('Not allowed');
    expect(byMsg(OPERATION_LOG_MSG)).toEqual([
      expect.objectContaining({ errorCount: 2, errorCodes: ['FORBIDDEN'] }),
    ]);
    expect(byMsg(ERROR_LOG_MSG)).toEqual([
      expect.objectContaining({
        level: 'warn',
        operationName: 'Guarded',
        message: 'Not allowed',
        code: 'FORBIDDEN',
        count: 2,
        paths: ['forbidden', 'also'],
      }),
    ]);
    // No stack for an expected error.
    expect(byMsg(ERROR_LOG_MSG)[0]).not.toHaveProperty('error');
  });

  it('writes one line for an operation rejected by validation', async () => {
    await post(yoga(), { query: 'query Broken { nope }' });

    expect(byMsg(OPERATION_LOG_MSG)).toEqual([
      expect.objectContaining({
        operationName: 'Broken',
        operationType: 'query',
        errorCount: 1,
        errorCodes: ['GRAPHQL_VALIDATION_FAILED'],
      }),
    ]);
    expect(byMsg(ERROR_LOG_MSG)).toEqual([]);
  });

  it('writes one line for an operation that fails to parse', async () => {
    await post(yoga(), { query: '{ hello' });

    expect(byMsg(OPERATION_LOG_MSG)).toEqual([
      expect.objectContaining({
        operationName: null,
        errorCount: 1,
        errorCodes: ['GRAPHQL_PARSE_FAILED'],
      }),
    ]);
  });

  it('writes one line for an operation whose context fails to build', async () => {
    const failingContext = useExtendContext(() => {
      throw new GraphQLError('Bad token', { extensions: { code: 'UNAUTHENTICATED' } });
    });

    await post(yoga([failingContext]), { query: 'query Greeting { hello }' });

    expect(byMsg(OPERATION_LOG_MSG)).toEqual([
      expect.objectContaining({
        operationName: 'Greeting',
        errorCount: 1,
        errorCodes: ['UNAUTHENTICATED'],
      }),
    ]);
  });

  it('logs a streamed (@defer) operation once, when the stream ends', async () => {
    const response = await yoga().fetch('http://localhost/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'multipart/mixed' },
      body: JSON.stringify({ query: 'query Deferred { hello ... @defer { slow } }' }),
    });
    await response.text();

    expect(byMsg(OPERATION_LOG_MSG)).toEqual([
      expect.objectContaining({
        operationName: 'Deferred',
        errorCount: 1,
        errorCodes: ['INTERNAL_SERVER_ERROR'],
      }),
    ]);
    expect(byMsg(ERROR_LOG_MSG)).toEqual([
      expect.objectContaining({ message: 'deferred failure', operationName: 'Deferred' }),
    ]);
  });

  it('groups identical errors across the chunks of a streamed operation', async () => {
    const response = await yoga().fetch('http://localhost/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'multipart/mixed' },
      body: JSON.stringify({
        query: 'query Guarded { forbidden ... @defer { slowForbidden } }',
      }),
    });
    await response.text();

    expect(byMsg(ERROR_LOG_MSG)).toEqual([
      expect.objectContaining({
        message: 'Not allowed',
        count: 2,
        paths: ['forbidden', 'slowForbidden'],
      }),
    ]);
  });

  it('writes a reference line, without the stack, for an error already logged in full', async () => {
    await post(yoga(), { query: 'query Update { upstream }' });

    const errors = byMsg(ERROR_LOG_MSG);
    expect(errors).toEqual([
      expect.objectContaining({
        level: 'error',
        operationName: 'Update',
        message: 'Green Invoice Update Client error: Invalid tax id',
        detailLogged: true,
      }),
    ]);
    expect(errors[0]).not.toHaveProperty('error');
    expect(byMsg(OPERATION_LOG_MSG)).toEqual([
      expect.objectContaining({ errorCount: 1, errorCodes: ['INTERNAL_SERVER_ERROR'] }),
    ]);
  });

  it('logs a deliberate INTERNAL_SERVER_ERROR as a fault, with its stack', async () => {
    const body = await post(yoga(), { query: 'query Onboard { deliberateFault }' });

    // Thrown on purpose, so the client sees the message.
    expect(body).toContain('Failed to create the onboarding business');
    expect(byMsg(ERROR_LOG_MSG)).toEqual([
      expect.objectContaining({
        level: 'error',
        code: 'INTERNAL_SERVER_ERROR',
        error: expect.objectContaining({ stack: expect.any(String) }),
      }),
    ]);
    expect(byMsg(OPERATION_LOG_MSG)).toEqual([
      expect.objectContaining({ errorCodes: ['INTERNAL_SERVER_ERROR'] }),
    ]);
  });
});
