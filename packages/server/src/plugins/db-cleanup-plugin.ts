import { Plugin } from 'graphql-yoga';
import { AccounterContext } from '../shared/types/index.js';

export function dbCleanupPlugin(): Plugin<AccounterContext> {
  return {
    onContextBuilding({ context }) {
      // Initialize the cleanup list
      // Cast to AccounterContext to avoid potential readonly issues or type mismatches
      // during initial context building phase.
      (context as AccounterContext).dbClientsToDispose = [];
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
