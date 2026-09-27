import { GraphQLError } from 'graphql';
import { createYoga, createSchema } from 'graphql-yoga';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toScraperUploadError, withScraperUploadErrors } from '../upload-error.helper.js';

/** Builds an error shaped like `pg`'s `DatabaseError`. */
function pgError(fields: {
  message: string;
  code: string;
  table?: string;
  constraint?: string;
  where?: string;
}): Error {
  return Object.assign(new Error(fields.message), { severity: 'ERROR', ...fields });
}

const RLS_ERROR = pgError({
  message: 'new row violates row-level security policy for table "charges"',
  code: '42501',
  where:
    'SQL statement "INSERT INTO accounter_schema.charges (owner_id, type)\n        VALUES (owner_id_var, NULL)\n        RETURNING id"\n' +
    'PL/pgSQL function accounter_schema.insert_poalim_ils_transaction_handler() line 44 at SQL statement',
});

describe('toScraperUploadError', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('turns an RLS violation into a readable, coded error', () => {
    const result = toScraperUploadError('uploadPoalimIlsTransactions', RLS_ERROR);

    expect(result.message).toBe(
      'uploadPoalimIlsTransactions failed: new row violates row-level security policy for table "charges" ' +
        '(in accounter_schema.insert_poalim_ils_transaction_handler() line 44)',
    );
    expect(result.extensions).toMatchObject({
      code: 'DB_PERMISSION_DENIED',
      operation: 'uploadPoalimIlsTransactions',
      sqlState: '42501',
      dbFunction: 'accounter_schema.insert_poalim_ils_transaction_handler() line 44',
    });
    expect(result.originalError).toBeUndefined();
  });

  it('does not return the SQL statement from the `where` context to the client', () => {
    const result = toScraperUploadError('uploadPoalimIlsTransactions', RLS_ERROR);

    expect(JSON.stringify(result.toJSON())).not.toContain('INSERT INTO');
  });

  it('logs a single concise line, keeping the full context server-side', () => {
    toScraperUploadError('uploadPoalimIlsTransactions', RLS_ERROR);

    expect(consoleError).toHaveBeenCalledTimes(1);
    const [line, ...rest] = consoleError.mock.calls[0];
    expect(rest).toEqual([]);
    expect(line).not.toContain('\n');
    expect(line).toContain('[42501] new row violates row-level security policy');
    expect(line).toContain('where=SQL statement "INSERT INTO accounter_schema.charges');
  });

  it('finds a driver error nested in the cause chain', () => {
    const wrapped = new Error('query failed', { cause: RLS_ERROR });

    expect(toScraperUploadError('op', wrapped).extensions.code).toBe('DB_PERMISSION_DENIED');
  });

  it('maps constraint violations and keeps the constraint name', () => {
    const result = toScraperUploadError(
      'op',
      pgError({
        message: 'duplicate key value violates unique constraint "poalim_ils_uniq"',
        code: '23505',
        table: 'poalim_ils_account_transactions',
        constraint: 'poalim_ils_uniq',
      }),
    );

    expect(result.extensions).toMatchObject({
      code: 'DB_CONFLICT',
      table: 'poalim_ils_account_transactions',
      constraint: 'poalim_ils_uniq',
    });
  });

  it('falls back to the SQLSTATE class for unlisted codes', () => {
    const result = toScraperUploadError(
      'op',
      pgError({ message: 'invalid input syntax for type integer: "x"', code: '22P02' }),
    );

    expect(result.extensions.code).toBe('DB_INVALID_DATA');
  });

  it('does not return a type error message, which echoes the uploaded value', () => {
    const result = toScraperUploadError(
      'op',
      pgError({ message: 'invalid input syntax for type integer: "4111-secret"', code: '22P02' }),
    );

    expect(result.message).toBe(
      'op failed: A value has an invalid format or is out of range for its column',
    );
    expect(JSON.stringify(result.toJSON())).not.toContain('4111-secret');
  });

  it("does not return a trigger's RAISE message, keeping only the function name", () => {
    const result = toScraperUploadError(
      'uploadPoalimSwiftTransactions',
      pgError({
        message: 'Account not found for account number: 123456',
        code: 'P0001',
        where:
          'PL/pgSQL function accounter_schema.insert_poalim_swift_transaction_handler() line 51 at RAISE',
      }),
    );

    expect(result.message).toBe(
      'uploadPoalimSwiftTransactions failed: A database trigger or function rejected the data ' +
        '(in accounter_schema.insert_poalim_swift_transaction_handler() line 51)',
    );
    expect(result.extensions.code).toBe('DB_REJECTED');
    expect(JSON.stringify(result.toJSON())).not.toContain('123456');
    expect(consoleError.mock.calls[0][0]).toContain('Account not found for account number: 123456');
  });

  it('reports a dead connection as retryable-unavailable', () => {
    const result = toScraperUploadError('op', new Error('Connection terminated unexpectedly'));

    expect(result.extensions.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('passes a GraphQLError through unchanged', () => {
    const original = new GraphQLError('no business context', {
      extensions: { code: 'FORBIDDEN' },
    });

    expect(toScraperUploadError('op', original)).toBe(original);
  });

  it('does not leak the message of an unrecognized error', () => {
    const result = toScraperUploadError('op', new TypeError('secret internal detail'));

    expect(result.message).toBe(
      'op failed due to an unexpected server error. See the server logs for details.',
    );
    expect(result.extensions.code).toBe('INTERNAL_SERVER_ERROR');
  });
});

describe('withScraperUploadErrors through yoga', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('survives yoga error masking', async () => {
    // maskedErrors left at its default (on), as in packages/server/src/index.ts.
    const yoga = createYoga({
      logging: false,
      schema: createSchema({
        typeDefs: /* GraphQL */ `
          type Query {
            upload: Boolean
          }
        `,
        resolvers: {
          Query: {
            upload: () =>
              withScraperUploadErrors('upload', () => Promise.reject(RLS_ERROR)),
          },
        },
      }),
    });

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ upload }' }),
    });
    const body = await response.json();

    expect(body.errors[0].message).toContain(
      'new row violates row-level security policy for table "charges"',
    );
    expect(body.errors[0].extensions.code).toBe('DB_PERMISSION_DENIED');
  });
});
