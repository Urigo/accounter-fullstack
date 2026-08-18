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
      const signal = accounterContext.request?.signal;
      if (signal) {
        if (signal.aborted) {
          void disposeClients(accounterContext);
          return;
        }
        signal.addEventListener('abort', () => void disposeClients(accounterContext), {
          once: true,
        });
      }
    },
    onExecute({ args }) {
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
                  await disposeClients(args.contextValue as AccounterContext);
                }
                return next;
              },
              return: async () => {
                // If the stream is cancelled/closed early
                await disposeClients(args.contextValue as AccounterContext);
                return originalIterator.return
                  ? originalIterator.return()
                  : { done: true, value: undefined };
              },
              throw: async e => {
                await disposeClients(args.contextValue as AccounterContext);
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
            await disposeClients(args.contextValue as AccounterContext);
          }
        },
      };
    },
  };
}

async function disposeClients(context: AccounterContext) {
  // Ensure context still exists and hasn't been corrupted
  if (context?.dbClientsToDispose) {
    await Promise.allSettled(context.dbClientsToDispose.map(client => client.dispose()));
    context.dbClientsToDispose = []; // prevent double disposal
  }
}
