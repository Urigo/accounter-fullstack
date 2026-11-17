import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestLogState } from '../shared/types/index.js';
import type { LogFields } from './log.js';

/**
 * Ambient request context for log lines.
 *
 * Each HTTP request runs in its own `AsyncLocalStorage` store (`withLogContext`, opened in
 * `index.ts` around the Yoga handler). `requestLogPlugin` attaches the operation's `RequestLogState`
 * to it, and `logContextFields` (installed with `setLogContextProvider`) adds that request's ids to
 * every `log()` line written while handling it — free functions and DataLoader callbacks included —
 * with no call-site changes. A call site's own fields still win.
 *
 * The store holds a reference to the live state, so `userId` / `businessId` appear on lines written
 * after `AuthContextProvider` records them.
 */
type LogContextStore = { requestLog?: RequestLogState };

const storage = new AsyncLocalStorage<LogContextStore>();

/** Runs `fn` in a fresh, empty context store: one per HTTP request. */
export function withLogContext<T>(fn: () => T): T {
  return storage.run({}, fn);
}

/**
 * Runs `fn` outside any request's context. For handlers of long-lived emitters (e.g. a pooled
 * socket's `'error'`), whose events run in the context of whichever request created them.
 */
export function withoutLogContext<T>(fn: () => T): T {
  return storage.exit(fn);
}

/** Ties the operation's request-log state to the current store. A no-op outside a store. */
export function attachRequestLog(state: RequestLogState): void {
  const store = storage.getStore();
  if (store) {
    store.requestLog = state;
  }
}

/** The current request's ids (nulls omitted), or nothing outside a request. */
export function logContextFields(): LogFields | undefined {
  const state = storage.getStore()?.requestLog;
  if (!state) {
    return undefined;
  }
  const fields: LogFields = {};
  for (const key of [
    'requestId',
    'correlationId',
    'operationName',
    'userId',
    'businessId',
  ] as const) {
    if (state[key] != null) {
      fields[key] = state[key];
    }
  }
  return fields;
}
