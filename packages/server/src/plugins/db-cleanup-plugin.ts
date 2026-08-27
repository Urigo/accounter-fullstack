import { Plugin } from 'graphql-yoga';
import { AccounterContext } from '../shared/types/index.js';

export function dbCleanupPlugin(): Plugin<AccounterContext> {
  return {
    onContextBuilding({ context }) {
      // Initialize the cleanup list
      // Cast to AccounterContext to avoid potential readonly issues or type mismatches
      // during initial context building phase.
      const accounterContext = context as AccounterContext;
      accounterContext.dbClientsToDispose = [];

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
          void disposeClients(accounterContext, { whenIdle: true });
          return;
        }
        signal.addEventListener(
          'abort',
          () => void disposeClients(accounterContext, { whenIdle: true }),
          { once: true },
        );
      }
    },
    onExecute({ args }) {
      const context = args.contextValue as AccounterContext;
      // Marks the window in which a quiet DB client belongs to a live request
      // rather than a leak. See `TenantAwareDBClient.operationInFlight`.
      context.executionInFlight = true;

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
                  await endExecution(context);
                }
                return next;
              },
              return: async () => {
                // If the stream is cancelled/closed early
                await endExecution(context);
                return originalIterator.return
                  ? originalIterator.return()
                  : { done: true, value: undefined };
              },
              throw: async e => {
                await endExecution(context);
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
            await endExecution(context);
          }
        },
      };
    },
  };
}

/** Execution is over: nothing is in flight any more, so disposal is unconditional. */
async function endExecution(context: AccounterContext) {
  if (context) {
    context.executionInFlight = false;
  }
  await disposeClients(context);
}

async function disposeClients(context: AccounterContext, options?: { whenIdle?: boolean }) {
  // Ensure context still exists and hasn't been corrupted
  if (!context?.dbClientsToDispose) {
    return;
  }

  const clients = context.dbClientsToDispose;
  context.dbClientsToDispose = []; // prevent double disposal

  const settled = await Promise.allSettled(
    clients.map(client =>
      options?.whenIdle && client.disposeWhenIdle ? client.disposeWhenIdle() : client.dispose(),
    ),
  );

  // A client that only *deferred* its disposal is still live and still owns a
  // connection, so it goes back on the list for the end-of-execution pass to
  // finish the job. Everything else is done with and stays off it.
  const deferred = clients.filter((_, index) => {
    const outcome = settled[index];
    return outcome?.status === 'fulfilled' && outcome.value === true;
  });
  if (deferred.length) {
    context.dbClientsToDispose = [...deferred, ...(context.dbClientsToDispose ?? [])];
  }
}
