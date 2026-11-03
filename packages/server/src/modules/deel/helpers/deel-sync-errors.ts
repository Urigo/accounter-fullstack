import { GraphQLError } from 'graphql';

export type DeelSyncIssueCode =
  | 'UNKNOWN_CONTRACT'
  | 'INCONSISTENT_CONTRACT_INFO'
  | 'AMBIGUOUS_PAYMENT_MATCH'
  | 'INVOICE_FILE_UNAVAILABLE'
  | 'ALREADY_PROCESSED'
  | 'PERSIST_FAILED'
  | 'CLEANUP_FAILED';

/**
 * Something the sync could not do. All codes but `CLEANUP_FAILED` mean nothing was written for
 * the invoices named; `CLEANUP_FAILED` is a warning on a unit that was saved.
 */
export type DeelSyncIssue = {
  code: DeelSyncIssueCode;
  message: string;
  invoiceIds: string[];
  receiptId?: string | null;
  contractId?: string | null;
};

/** Thrown inside a unit's transaction when another sync run already wrote one of its invoices */
export class DeelSyncConflictError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DeelSyncConflictError';
  }
}

/**
 * Flatten an error and its `cause` chain into one message, so the root reason reaches the user
 * instead of only the outermost wrapper — e.g. "Failed to fetch Deel salary invoices: Deel API GET
 * /invoices responded 503 Service Unavailable".
 */
export function describeError(error: unknown): string {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current != null && !seen.has(current)) {
    seen.add(current);
    const message = (current instanceof Error ? current.message : String(current)).trim();
    if (message && !messages.at(-1)?.includes(message)) {
      messages.push(message);
    }
    // a GraphQLError's message is already meant for the user
    if (current instanceof GraphQLError) {
      break;
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return messages.join(': ') || 'Unknown error';
}

/** A Postgres error (pg's `DatabaseError`): its text names tables and constraints */
function isDatabaseError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'severity' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

/** Whether an error chain contains a Postgres error with the given SQLSTATE */
export function hasDatabaseErrorCode(error: unknown, sqlState: string): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    if (isDatabaseError(current) && (current as { code?: string }).code === sqlState) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

/**
 * Like {@link describeError}, but for the browser: what failed, without internal detail. Database
 * errors are summarized (their text names tables and constraints), an error carrying a
 * `publicMessage` — e.g. a Deel API failure, whose full message quotes the response body and the
 * values Deel sent — contributes only that, and anything hidden is pointed to in the server logs,
 * where the full chain is logged.
 */
export function describeErrorForUser(error: unknown): string {
  const messages: string[] = [];
  let hidden = false;
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current != null && !seen.has(current)) {
    seen.add(current);
    if (current instanceof GraphQLError) {
      messages.push(current.message);
      break;
    }
    const publicMessage = (current as { publicMessage?: unknown }).publicMessage;
    if (typeof publicMessage === 'string') {
      messages.push(publicMessage);
      hidden ||= current instanceof Error && current.message !== publicMessage;
      break;
    }
    if (isDatabaseError(current)) {
      messages.push('a database error occurred');
      hidden = true;
      break;
    }
    if (!(current instanceof Error)) {
      messages.push('an unexpected error occurred');
      hidden = true;
      break;
    }
    const message = current.message.trim();
    if (message && !messages.at(-1)?.includes(message)) {
      messages.push(message);
    }
    current = current.cause;
  }
  const text = messages.join(': ') || 'Unknown error';
  return hidden ? `${text} (details in the server logs)` : text;
}
