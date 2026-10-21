import { GraphQLError } from 'graphql';

export type DeelSyncIssueCode =
  | 'UNKNOWN_CONTRACT'
  | 'INCONSISTENT_CONTRACT_INFO'
  | 'AMBIGUOUS_PAYMENT_MATCH'
  | 'MISSING_CHARGE'
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
  constructor(message: string) {
    super(message);
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
