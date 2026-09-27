import { GraphQLError } from 'graphql';
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
 * Postgres' own message (table, constraint or policy name — no row data) and the
 * failing trigger function are safe to return and are what points at the cause.
 * Anything that is not a recognized DB error keeps its message server-side only.
 *
 * `originalError` is deliberately never set: yoga masks any `GraphQLError` whose
 * `originalError` is not itself a `GraphQLError`, which would undo all of this.
 */
export function toScraperUploadError(operation: string, error: unknown): GraphQLError {
  if (error instanceof GraphQLError) {
    console.error(`[scraper-ingestion] ${operation} failed: ${error.message}`);
    return error;
  }

  if (isConnectionLevelError(error)) {
    console.error(`[scraper-ingestion] ${operation} failed: database connection error`, error);
    return new GraphQLError(
      `${operation} failed: the server lost its database connection. Try again in a moment.`,
      { extensions: { code: 'SERVICE_UNAVAILABLE', operation } },
    );
  }

  const pgError = findPgDatabaseError(error);
  if (pgError) {
    const { code, hint } = categorize(pgError.code);
    const dbFunction = extractDbFunction(pgError.where);
    const location = dbFunction ? ` (in ${dbFunction})` : '';
    console.error(
      `[scraper-ingestion] ${operation} failed: [${pgError.code}] ${pgError.message}${location}`,
      error,
    );
    return new GraphQLError(`${operation} failed: ${pgError.message}${location}`, {
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
  return new GraphQLError(
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
