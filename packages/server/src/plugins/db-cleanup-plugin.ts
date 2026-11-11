import { randomUUID } from 'node:crypto';
import { Kind, type DocumentNode } from 'graphql';
import { Plugin } from 'graphql-yoga';
import { isSpanContextValid, trace } from '@opentelemetry/api';
import type { AccounterContext, DbRequestState } from '../shared/types/index.js';

export function dbCleanupPlugin(): Plugin<AccounterContext> {
  return {
    onContextBuilding({ context }) {
      // Cast to AccounterContext to avoid potential readonly issues or type mismatches
      // during initial context building phase.
      const accounterContext = context as AccounterContext;
      // One object, only ever mutated in place: DB clients see a per-module copy
      // of the context, which shares this reference but not later assignments.
      // See `DbRequestState`.
      const state: DbRequestState = {
        clientsToDispose: [],
        executionInFlight: false,
        disposed: false,
        requestId: currentRequestId(),
        operationName: null,
      };
      accounterContext.dbRequest = state;

      // Dispose when the client goes away.
      //
      // `onExecuteDone` below only runs when execution *completes*. A request
      // the client cancels mid-flight (urql aborts the previous query on every
      // keystroke of a search box) rejects with an AbortError instead, so the
      // hook never fires and the request-scoped connection is never released:
      // it stays checked out of the pool, holding an open transaction, until
      // the process restarts. Postgres reports these as `idle in transaction`
      // with `wait_event = ClientRead`. Enough of them and the pool is gone and
      // every subsequent request hangs forever in `pool.connect()`.
      //
      // The abort is handled with `disposeWhenIdle` rather than `dispose`,
      // because the caller hanging up does not stop the operation this server is
      // already running — nothing can cancel the promise chain a resolver is on.
      // A document upload whose caller timed out mid-OCR still has a Cloudinary
      // upload and an INSERT ahead of it; pulling its connection there fails the
      // write with "TenantAwareDBClient is already disposed" and loses the work
      // for good. Deferring costs the pool a connection until the operation
      // finishes (or the watchdog reclaims it); yanking it costs the user a
      // document.
      const signal = accounterContext.request?.signal;
      if (signal) {
        if (signal.aborted) {
          void disposeClients(state, { whenIdle: true });
          return;
        }
        signal.addEventListener('abort', () => void disposeClients(state, { whenIdle: true }), {
          once: true,
        });
      }
    },
    onExecute({ args }) {
      const state = (args.contextValue as AccounterContext).dbRequest;
      if (state) {
        // Marks the window in which a quiet DB client belongs to a live request
        // rather than a leak. See `TenantAwareDBClient.operationInFlight`.
        state.executionInFlight = true;
        // Names the operation in DB log lines (leak reclaimed, session killed),
        // so a leak can be traced to the request that caused it.
        state.operationName = args.operationName ?? operationNameOf(args.document) ?? 'anonymous';
      }

      return {
        async onExecuteDone({ result }) {
          // If the result is an async iterable (stream/defer), wrap it.
          // This allows us to defer cleanup until the entire stream is consumed or the connection is closed.
          // Standard onExecuteDone fires before the stream is completely consumed.
          if (Symbol.asyncIterator in result) {
            const originalIterator = result[Symbol.asyncIterator]();

            result[Symbol.asyncIterator] = () => ({
              next: async () => {
                const next = await originalIterator.next();
                if (next.done) {
                  await endExecution(state);
                }
                return next;
              },
              return: async () => {
                // If the stream is cancelled/closed early
                await endExecution(state);
                return originalIterator.return
                  ? originalIterator.return()
                  : { done: true, value: undefined };
              },
              throw: async e => {
                await endExecution(state);
                return originalIterator.throw
                  ? originalIterator.throw(e)
                  : { done: true, value: undefined };
              },
              [Symbol.asyncIterator]() {
                return this;
              },
            });
          } else {
            // Regular execution (single response), clean up immediately.
            // CRITICAL: Must await to ensure connections are released before response is sent.
            // Without await, connections accumulate under load faster than they're freed.
            await endExecution(state);
          }
        },
      };
    },
  };
}

/** Execution is over: nothing is in flight any more, so disposal is unconditional. */
async function endExecution(state: DbRequestState | undefined) {
  if (!state) {
    return;
  }
  state.executionInFlight = false;
  // Set before draining, so a client constructed while disposal is still
  // running is covered too. From here on nothing will dispose a newly
  // registered client, so TenantAwareDBClient must not hold a connection.
  state.disposed = true;
  await disposeClients(state);
}

/** The OTel trace id when tracing is on (so a log line pivots to the trace), else a random id. */
function currentRequestId(): string {
  const spanContext = trace.getActiveSpan()?.spanContext();
  return spanContext && isSpanContextValid(spanContext) ? spanContext.traceId : randomUUID();
}

function operationNameOf(document: DocumentNode | undefined): string | undefined {
  for (const definition of document?.definitions ?? []) {
    if (definition.kind === Kind.OPERATION_DEFINITION && definition.name) {
      return definition.name.value;
    }
  }
  return undefined;
}

async function disposeClients(state: DbRequestState, options?: { whenIdle?: boolean }) {
  // Drained in place (never reassigned), so every holder of the state object
  // keeps seeing the live list. Emptying it first prevents double disposal.
  const clients = state.clientsToDispose.splice(0);

  const settled = await Promise.allSettled(
    clients.map(client =>
      options?.whenIdle && client.disposeWhenIdle ? client.disposeWhenIdle() : client.dispose(),
    ),
  );

  // End-of-execution disposal is final: whatever happened, there is no later
  // pass to hand these to, and the watchdog is the backstop for a failure.
  if (!options?.whenIdle) {
    return;
  }

  // A client that only *deferred* its disposal is still live and still owns a
  // connection, so it goes back on the list for the end-of-execution pass to
  // finish the job. So does one whose deferral *failed*: a rejection released
  // nothing, and dropping it here would strand a checked-out connection with
  // nothing left to release it.
  const unreleased = clients.filter((_, index) => {
    const outcome = settled[index];
    return outcome?.status !== 'fulfilled' || outcome.value === true;
  });
  if (unreleased.length) {
    state.clientsToDispose.unshift(...unreleased);
  }
}
