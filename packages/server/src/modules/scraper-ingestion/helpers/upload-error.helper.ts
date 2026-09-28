import { GraphQLError } from 'graphql';
import { createGraphQLError } from '@graphql-tools/utils';
import { isConnectionLevelError } from '../../email-ingestion/helpers/email-ingestion-tenant-context.helper.js';

/**
 * The fields of a `pg` `DatabaseError` this helper reads. Duck-typed rather than
 * matched with `instanceof`, since the error can come from a different copy of
 * `pg-protocol` than the one this module would import.
 */
type PgDatabaseError = Error & {
  code: string;
  severity?: string;
  table?: string;
  constraint?: string;
  column?: string;
  where?: string;
};

type PgErrorCategory = {
  code: string;
  hint: string;
};

/**
 * SQLSTATE → client-facing error code and hint. Classes are matched by their
 * two-character prefix when the exact state is not listed.
 */
const PG_ERROR_CATEGORIES: Record<string, PgErrorCategory> = {
  '42501': {
    code: 'DB_PERMISSION_DENIED',
    hint: 'The database refused the write for the current business (row-level security or missing privilege).',
  },
  '23505': {
    code: 'DB_CONFLICT',
    hint: 'A row with the same unique key already exists.',
  },
  '23503': {
    code: 'DB_REFERENCE_MISSING',
    hint: 'The row references a record that does not exist.',
  },
  '23502': {
    code: 'DB_INVALID_DATA',
    hint: 'A required field was empty.',
  },
  '23514': {
    code: 'DB_INVALID_DATA',
    hint: 'A value failed a database check constraint.',
  },
  P0001: {
    code: 'DB_REJECTED',
    hint: 'A database trigger or function rejected the data.',
  },
};

const PG_ERROR_CLASSES: Record<string, PgErrorCategory> = {
  '22': {
    code: 'DB_INVALID_DATA',
    hint: 'A value has an invalid format or is out of range for its column.',
  },
  '23': {
    code: 'DB_INVALID_DATA',
    hint: 'The data violates a database constraint.',
  },
};

/**
 * SQLSTATEs whose Postgres message is built from schema metadata only — table,
 * column, constraint or policy names — and so may be returned to the client as is.
 * For these the row values, when Postgres reports them at all, go into `detail`,
 * which is never returned. Every other state's message may carry uploaded data (a
 * type error echoes the invalid input; a trigger's `RAISE EXCEPTION` interpolates
 * `NEW` values), so the client gets the category hint instead and the raw message
 * stays in the server log.
 */
const CLIENT_SAFE_MESSAGE_STATES = new Set([
  '42501', // insufficient_privilege / RLS policy violation
  '23505', // unique_violation
  '23503', // foreign_key_violation
  '23502', // not_null_violation
  '23514', // check_violation
]);

const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/;
const MAX_CAUSE_DEPTH = 5;

function isPgDatabaseError(error: unknown): error is PgDatabaseError {
  if (!(error instanceof Error)) return false;
  const { code, severity } = error as Partial<PgDatabaseError>;
  return typeof code === 'string' && SQLSTATE_PATTERN.test(code) && typeof severity === 'string';
}

/** Walks the `cause` chain, since some DB wrappers rethrow the driver error as a cause. */
function findPgDatabaseError(error: unknown): PgDatabaseError | null {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current; depth++) {
    if (isPgDatabaseError(current)) return current;
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
}

/**
 * Pulls the innermost PL/pgSQL function out of Postgres' `where` context, e.g.
 * `PL/pgSQL function accounter_schema.insert_poalim_ils_transaction_handler() line 44 at SQL statement`
 * → `accounter_schema.insert_poalim_ils_transaction_handler() line 44`.
 * Only the function name and line are kept; the `where` text also quotes the SQL
 * statement, which is not meant for the client.
 */
function extractDbFunction(where: string | undefined): string | undefined {
  if (!where) return undefined;
  const matches = [...where.matchAll(/PL\/pgSQL function ([\w.]+\([^)]*\))(?: line (\d+))?/g)];
  const last = matches.at(-1);
  if (!last) return undefined;
  return last[2] ? `${last[1]} line ${last[2]}` : last[1];
}

function categorize(sqlState: string): PgErrorCategory {
  return (
    PG_ERROR_CATEGORIES[sqlState] ??
    PG_ERROR_CLASSES[sqlState.slice(0, 2)] ?? {
      code: 'DB_ERROR',
      hint: 'The database rejected the operation.',
    }
  );
}

/**
 * Translates a failure inside a scraper upload into a `GraphQLError` the client can
 * act on, and logs it once, concisely, on the server.
 *
 * Without this, a rejected statement (RLS, constraint, bad value) reaches yoga as a
 * plain error, which its default `maskedErrors` turns into "Unexpected error." — the
 * scraper then shows that, with no hint of which table or rule refused the rows.
 * The failing trigger function is always returned, since it points at the cause.
 * Postgres' own message is returned only for the states in
 * {@link CLIENT_SAFE_MESSAGE_STATES}; otherwise the client gets the category hint.
 * Anything that is not a recognized DB error keeps its message server-side only.
 *
 * `originalError` is deliberately never set: yoga masks any `GraphQLError` whose
 * `originalError` is not itself a `GraphQLError`, which would undo all of this.
 * Errors are built with `createGraphQLError` (the factory yoga itself uses) so they
 * come from the same `graphql` copy yoga checks against, even where a bundler would
 * resolve `graphql` to its ESM entry and Node to its CJS one (as vitest does).
 */
export function toScraperUploadError(operation: string, error: unknown): GraphQLError {
  if (error instanceof GraphQLError) {
    console.error(`[scraper-ingestion] ${operation} failed: ${error.message}`);
    return error;
  }

  if (isConnectionLevelError(error)) {
    console.error(`[scraper-ingestion] ${operation} failed: database connection error`, error);
    return createGraphQLError(
      `${operation} failed: the server lost its database connection. Try again in a moment.`,
      { extensions: { code: 'SERVICE_UNAVAILABLE', operation } },
    );
  }

  const pgError = findPgDatabaseError(error);
  if (pgError) {
    const { code, hint } = categorize(pgError.code);
    const dbFunction = extractDbFunction(pgError.where);
    const location = dbFunction ? ` (in ${dbFunction})` : '';
    // One log line instead of the full driver error dump; `where` is kept
    // server-side because it quotes the exact statement inside the trigger.
    const context = [
      pgError.table && `table=${pgError.table}`,
      pgError.constraint && `constraint=${pgError.constraint}`,
      pgError.where && `where=${pgError.where.replaceAll(/\s+/g, ' ')}`,
    ]
      .filter(Boolean)
      .join(' | ');
    console.error(
      `[scraper-ingestion] ${operation} failed: [${pgError.code}] ${pgError.message}${location}` +
        (context ? ` | ${context}` : ''),
    );
    const clientMessage = CLIENT_SAFE_MESSAGE_STATES.has(pgError.code)
      ? pgError.message
      : hint.replace(/\.$/, '');
    return createGraphQLError(`${operation} failed: ${clientMessage}${location}`, {
      extensions: {
        code,
        operation,
        hint,
        sqlState: pgError.code,
        ...(pgError.table && { table: pgError.table }),
        ...(pgError.constraint && { constraint: pgError.constraint }),
        ...(pgError.column && { column: pgError.column }),
        ...(dbFunction && { dbFunction }),
      },
    });
  }

  console.error(`[scraper-ingestion] ${operation} failed with an unexpected error:`, error);
  return createGraphQLError(
    `${operation} failed due to an unexpected server error. See the server logs for details.`,
    { extensions: { code: 'INTERNAL_SERVER_ERROR', operation } },
  );
}

/** Runs a scraper upload, translating any failure with {@link toScraperUploadError}. */
export async function withScraperUploadErrors<T>(
  operation: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toScraperUploadError(operation, error);
  }
}
