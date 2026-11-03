import { toast } from 'sonner';
import { stringifyVariables } from 'urql';

/**
 * Default dedupe window for mutations whose accidental repeat does harm: ones that create records,
 * reach an external service, or cost money. Long enough to cover a double-click, a re-submitted
 * dialog or an impatient retry; short enough not to get in the way of a deliberate repeat.
 */
export const MUTATION_DEDUPE_WINDOW_MS = 20_000;

type CallEntry = { expiresAt: number };

/**
 * Calls of a deduplicated mutation that are in flight or settled recently, keyed by the mutation
 * document and then by its serialized variables. Module-level on purpose: every mounted instance
 * of a hook shares it, so a second component — or a remount — is blocked too.
 */
let recentCalls = new WeakMap<object, Map<string, CallEntry>>();

/**
 * Forgets every recorded call. Called whenever the urql client is reset — a business-scope switch
 * or a logout — because most mutations take their owner from the request scope, not from their
 * variables: the same call for another business or user is not a duplicate. Tests use it too, as
 * the guard is module-level.
 */
export function resetMutationDedupe(): void {
  recentCalls = new WeakMap();
}

function getRecentCalls(document: object): Map<string, CallEntry> {
  let calls = recentCalls.get(document);
  if (!calls) {
    calls = new Map();
    recentCalls.set(document, calls);
  }
  return calls;
}

/**
 * Ends a claimed call. `keepWindow: true` keeps the guard for the window from now on — use it
 * whenever the mutation may have run. `false` lifts it at once, so the user can retry; only for a
 * failure that guarantees nothing ran on the server.
 */
export type ReleaseMutationCall = (keepWindow: boolean) => void;

/**
 * Claims a call of `document` with `variables`, or returns `null` when an identical call is in
 * flight or settled less than `windowMs` ago. Synchronous, so call it before awaiting anything:
 * then even two clicks in the same tick cannot both get through.
 *
 * Files and blobs in the variables are keyed by identity (`stringifyVariables`' `includeFiles`):
 * re-submitting the same `File` is a duplicate, uploading a different one is not. Without it urql
 * serializes every file as `null`, and two different uploads would collide.
 */
export function claimMutationCall(
  document: object,
  variables: unknown,
  windowMs: number,
): ReleaseMutationCall | null {
  const calls = getRecentCalls(document);
  const key = stringifyVariables(variables, true);
  const existing = calls.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    return null;
  }
  const entry: CallEntry = { expiresAt: Number.POSITIVE_INFINITY };
  calls.set(key, entry);
  return keepWindow => {
    if (keepWindow) {
      entry.expiresAt = Date.now() + windowMs;
    } else if (calls.get(key) === entry) {
      calls.delete(key);
    }
  };
}

/** The notification for a call `claimMutationCall` blocked. */
export function notifyDuplicateBlocked(notificationId: string): void {
  toast.warning('Duplicate request blocked', {
    description: 'This exact operation was just submitted, so it was not sent again.',
    // Its own id, so it does not replace the in-flight call's loading toast.
    id: `${notificationId}-duplicate`,
  });
}
