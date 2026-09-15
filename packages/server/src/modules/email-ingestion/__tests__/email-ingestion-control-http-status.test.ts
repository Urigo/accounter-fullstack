import { createYoga } from 'graphql-yoga';
import { useSchema } from '@envelop/core';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { createApplication, createModule, gql, Scope } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import { EmailIngestionControlProvider } from '../providers/email-ingestion-control.provider.js';
import { emailIngestionControlResolver } from '../resolvers/email-ingestion-control.resolver.js';

/**
 * Asserts the *HTTP status* the gateway actually observes, not just the error
 * extension the resolver sets.
 *
 * The extension alone proves nothing: yoga answers a GraphQL error with HTTP 200 by
 * default, and the gateway's `isRetryable` keys on the transport status, so it is
 * yoga's translation of `extensions.http.status` that decides whether the retry
 * budget engages. That translation is the thing under test here.
 *
 * `maskedErrors` is deliberately left at its default (on), matching
 * `packages/server/src/index.ts` — a harness that disabled it would not prove the
 * status survives in production. It does survive, but not because the error escapes
 * masking: yoga *does* replace the message with "Unexpected error." and drop
 * `extensions.code`. What rescues the status is that `maskError` explicitly copies
 * `extensions.http` onto the masked error, which
 * `getResponseInitByRespectingErrors` then reads. So the status is the only part of
 * the signal that crosses the wire — which is exactly the part the gateway keys on,
 * and the reason these tests assert the status rather than the body.
 */
function makeYoga(resolveAliasError: Error) {
  const controlProvider: Partial<EmailIngestionControlProvider> = {
    resolveAlias: vi.fn().mockRejectedValue(resolveAliasError),
  };

  const testModule = createModule({
    id: 'email-ingestion-control-http-status-test',
    providers: [
      {
        provide: EmailIngestionControlProvider,
        useFactory: () => controlProvider,
        scope: Scope.Singleton,
      },
    ],
    typeDefs: [
      gql`
        input IngestControlInput {
          recipientAlias: String!
          messageId: String!
          rawMessageHash: String!
          correlationId: String
        }

        type IngestControlDecision {
          id: ID!
        }

        type CommonError {
          message: String!
        }

        union IngestControlResult = IngestControlDecision | CommonError

        type Query {
          noop: String
        }

        type Mutation {
          requestIngestControl(input: IngestControlInput!): IngestControlResult!
        }
      `,
    ],
    resolvers: {
      Query: { noop: () => null },
      Mutation: {
        requestIngestControl: emailIngestionControlResolver.Mutation.requestIngestControl,
      },
    },
  });

  const application = createApplication({ modules: [testModule] });

  return createYoga({
    plugins: [useGraphQLModules(application), useSchema(application.schema)],
  });
}

const MUTATION = `
  mutation {
    requestIngestControl(input: {
      recipientAlias: "invoice@tenant.example.com"
      messageId: "msg-1"
      rawMessageHash: "sha256-abc"
    }) {
      __typename
    }
  }
`;

async function post(yoga: ReturnType<typeof makeYoga>) {
  const response = await yoga.fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: MUTATION }),
  });
  return { status: response.status, body: await response.json() };
}

describe('requestIngestControl HTTP status', () => {
  // The gateway retries a 5xx (server-client.ts `isRetryable`), so this status is
  // what re-arms the CONTROL_MAX_RETRIES budget that #4347 widened and #4344 needed.
  it('answers 503 when the pooled connection died', async () => {
    const yoga = makeYoga(new Error('Connection terminated unexpectedly'));
    const { status, body } = await post(yoga);

    expect(status).toBe(503);
    // Masked to a generic message by yoga's default `maskedErrors`; the status is
    // what carries the retry signal.
    expect(body.errors?.[0]?.message).toBe('Unexpected error.');
  });

  it('answers 503 for a socket errno too', async () => {
    const err: NodeJS.ErrnoException = new Error('read ECONNRESET');
    err.code = 'ECONNRESET';
    const { status } = await post(makeYoga(err));

    expect(status).toBe(503);
  });

  // A rejected statement fails identically on every retry, so it must stay a
  // non-retryable 200 rather than burning the gateway's budget.
  it('leaves a statement error at 200 so the gateway does not retry', async () => {
    const err: NodeJS.ErrnoException = new Error('permission denied for table alias_routing');
    err.code = '42501';
    const { status, body } = await post(makeYoga(err));

    expect(status).toBe(200);
    expect(body.errors?.[0]?.message).toBe('Unexpected error.');
  });
});
