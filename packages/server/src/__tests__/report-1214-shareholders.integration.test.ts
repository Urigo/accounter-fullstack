import { createRequire } from 'node:module';
import { createYoga } from 'graphql-yoga';
import type { PoolClient } from 'pg';
import { useSchema } from '@envelop/core';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeUUID } from '../demo-fixtures/helpers/deterministic-uuid.js';
import { env } from '../environment.js';
import { createGraphQLApp } from '../modules-app.js';
import { dbCleanupPlugin } from '../plugins/db-cleanup-plugin.js';
import { TestDatabase } from './helpers/db-setup.js';
import { dropRlsRole, ensureRlsRole, runAsRlsRole } from './helpers/rls-role.js';
import { qualifyTable } from './helpers/test-db-config.js';

/**
 * Form 1214 shareholders API end to end: `setShareholders`, `shareholders` and
 * `copyShareholdersFromYear` through the real application (`createGraphQLApp`) with dev-bypass
 * identities, plus the `shareholders` RLS policy evaluated under a non-superuser role.
 *
 * The suite only touches years 2091-2099 of its owners, so it cannot collide with real data or
 * other suites.
 */

// See timeless-dates.integration.test.ts: keep graphql in one (CommonJS) realm with graphql-modules
vi.mock('graphql', () => createRequire(import.meta.url)('graphql'));

const unbuiltPackageStub = vi.hoisted(
  () => () =>
    new Proxy(
      {},
      {
        has: () => true,
        get: (_, key) =>
          key === 'then'
            ? undefined
            : () => {
                throw new Error(`${String(key)} is stubbed in the shareholders test`);
              },
      },
    ),
);
vi.mock('@accounter/green-invoice-graphql', unbuiltPackageStub);
vi.mock('@accounter/shaam-uniform-format-generator', unbuiltPackageStub);

/**
 * The suite's own owner company. It never touches the shared seeded Admin Business: another suite
 * may delete that business's `businesses_admin` row, which cascades to its `business_users` and
 * would sign this suite's user out mid-run.
 */
const OWNER_ID = makeUUID('business', 'report-1214-shareholders-owner');
const USER_ID = makeUUID('user', 'report-1214-shareholders-user');
/** A second tenant, with its own user, that must not see the admin's shareholders */
const OTHER_OWNER_ID = makeUUID('business', 'report-1214-shareholders-other-owner');
const OTHER_USER_ID = makeUUID('user', 'report-1214-shareholders-other-user');
/** A business in the admin's books, linkable as a shareholder's financial entity */
const LINKED_BUSINESS_ID = makeUUID('business', 'report-1214-shareholders-linked');

const YEAR = 2091;
const OTHER_YEAR = 2092;
const EMPTY_YEAR = 2093;

const SHAREHOLDER_FIELDS = /* GraphQL */ `
  id
  year
  idNumber
  fullName
  isControllingShareholder
  dividendRightsPercent
  votingRightsPercent
  otherRightsPercent
  isMaterialShareholder
  salaryMonths1To9
  salaryMonths10To12
  otherPayments
  businessId
  business {
    id
    name
  }
`;

const SHAREHOLDERS_QUERY = /* GraphQL */ `
  query Report1214Shareholders($ownerId: UUID, $year: Int!) {
    shareholders(ownerId: $ownerId, year: $year) {
      ${SHAREHOLDER_FIELDS}
    }
  }
`;

const SET_SHAREHOLDERS_MUTATION = /* GraphQL */ `
  mutation Report1214SetShareholders(
    $ownerId: UUID
    $year: Int!
    $shareholders: [ShareholderInput!]!
  ) {
    setShareholders(ownerId: $ownerId, year: $year, shareholders: $shareholders) {
      ${SHAREHOLDER_FIELDS}
    }
  }
`;

const COPY_SHAREHOLDERS_MUTATION = /* GraphQL */ `
  mutation Report1214CopyShareholders($ownerId: UUID, $fromYear: Int!, $toYear: Int!) {
    copyShareholdersFromYear(ownerId: $ownerId, fromYear: $fromYear, toYear: $toYear) {
      ${SHAREHOLDER_FIELDS}
    }
  }
`;

type Shareholder = {
  id: string;
  year: number;
  idNumber: string;
  fullName: string;
  isControllingShareholder: boolean;
  dividendRightsPercent: number | null;
  votingRightsPercent: number | null;
  otherRightsPercent: number | null;
  isMaterialShareholder: boolean | null;
  salaryMonths1To9: number | null;
  salaryMonths10To12: number | null;
  otherPayments: number | null;
  businessId: string | null;
  business: { id: string; name: string } | null;
};

type ShareholderInput = {
  idNumber: string;
  fullName: string;
  isControllingShareholder: boolean;
  dividendRightsPercent?: number | null;
  votingRightsPercent?: number | null;
  otherRightsPercent?: number | null;
  isMaterialShareholder?: boolean | null;
  salaryMonths1To9?: number | null;
  salaryMonths10To12?: number | null;
  otherPayments?: number | null;
  businessId?: string | null;
};

type GraphQLResponse<T> = {
  data?: T | null;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
};

let db: TestDatabase;
let yoga: { fetch: (url: string, init: RequestInit) => Response | Promise<Response> };
let otherYoga: typeof yoga;

async function executeRaw<T>(
  query: string,
  variables: Record<string, unknown> = {},
  app: typeof yoga = yoga,
) {
  const response = await app.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return (await response.json()) as GraphQLResponse<T>;
}

async function execute<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const json = await executeRaw<T>(query, variables);
  expect(json.errors).toBeUndefined();
  return json.data!;
}

const getShareholders = (year: number, ownerId: string | null = OWNER_ID) =>
  execute<{ shareholders: Shareholder[] }>(SHAREHOLDERS_QUERY, { ownerId, year }).then(
    data => data.shareholders,
  );

const setShareholders = (year: number, shareholders: ShareholderInput[]) =>
  execute<{ setShareholders: Shareholder[] }>(SET_SHAREHOLDERS_MUTATION, {
    ownerId: OWNER_ID,
    year,
    shareholders,
  }).then(data => data.setShareholders);

/** The first error of a call expected to fail, with its code */
async function expectError(
  query: string,
  variables: Record<string, unknown>,
  app: typeof yoga = yoga,
) {
  const json = await executeRaw(query, variables, app);
  expect(json.errors?.length).toBeGreaterThan(0);
  const [error] = json.errors!;
  return { message: error.message, code: error.extensions?.code };
}

async function withSuperuserClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_business_id', $1, true)", [OWNER_ID]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function ensureBusiness(client: PoolClient, id: string, ownerId: string, name: string) {
  await client.query(
    `INSERT INTO ${qualifyTable('financial_entities')} (id, name, type, owner_id)
     VALUES ($1, $2, 'business', NULL) ON CONFLICT (id) DO NOTHING`,
    [id, name],
  );
  await client.query(
    `INSERT INTO ${qualifyTable('businesses')} (id, country, owner_id)
     VALUES ($1, 'ISR', $2) ON CONFLICT (id) DO NOTHING`,
    [id, ownerId],
  );
  await client.query(`UPDATE ${qualifyTable('financial_entities')} SET owner_id = $2 WHERE id = $1`, [
    id,
    ownerId,
  ]);
}

async function removeShareholders() {
  await withSuperuserClient(client =>
    client.query(
      `DELETE FROM ${qualifyTable('shareholders')}
       WHERE owner_id = ANY($1) AND year BETWEEN 2091 AND 2099`,
      [[OWNER_ID, OTHER_OWNER_ID]],
    ),
  );
}

const dana: ShareholderInput = {
  idNumber: '42',
  fullName: '  Dana Cohen ',
  isControllingShareholder: true,
  dividendRightsPercent: 60,
  votingRightsPercent: 60.125,
  otherRightsPercent: null,
  isMaterialShareholder: true,
  salaryMonths1To9: 90_000,
  salaryMonths10To12: 30_000.5,
  otherPayments: 0,
};
const holdco: ShareholderInput = {
  idNumber: '516123452',
  fullName: 'Holdco Ltd',
  isControllingShareholder: false,
  dividendRightsPercent: 40,
  votingRightsPercent: 39.875,
};

beforeAll(async () => {
  db = new TestDatabase();
  await db.connect();
  await db.ensureLatestSchema();
  await ensureRlsRole(db.getPool(), {
    // the role is per worker and dropped with its grants in afterAll (dropRlsRole)
    grants: [{ table: 'shareholders', privileges: 'SELECT, INSERT, DELETE' }],
  });

  await withSuperuserClient(async client => {
    // `business_users` references `businesses_admin`
    await ensureBusiness(client, OWNER_ID, OWNER_ID, 'Shareholders owner');
    await client.query(
      `INSERT INTO ${qualifyTable('businesses_admin')} (id, owner_id) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [OWNER_ID],
    );
    await client.query(
      `INSERT INTO ${qualifyTable('business_users')} (user_id, business_id, role_id)
       VALUES ($1, $2, 'business_owner') ON CONFLICT DO NOTHING`,
      [USER_ID, OWNER_ID],
    );

    await ensureBusiness(client, OTHER_OWNER_ID, OTHER_OWNER_ID, 'Shareholders other owner');
    await client.query(
      `INSERT INTO ${qualifyTable('businesses_admin')} (id, owner_id) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [OTHER_OWNER_ID],
    );
    await client.query(
      `INSERT INTO ${qualifyTable('business_users')} (user_id, business_id, role_id)
       VALUES ($1, $2, 'business_owner') ON CONFLICT DO NOTHING`,
      [OTHER_USER_ID, OTHER_OWNER_ID],
    );

    await ensureBusiness(client, LINKED_BUSINESS_ID, OWNER_ID, 'Shareholders linked holdco');
  });

  const pool = db.getPool();
  const { application, transformedSchema } = await createGraphQLApp(env, pool);
  const yogaFor = (userId: string) =>
    createYoga({
      maskedErrors: false,
      logging: false,
      plugins: [dbCleanupPlugin(), useGraphQLModules(application), useSchema(transformedSchema)],
      context: () => ({ env, pool, rawAuth: { authType: 'devBypass', token: userId } }),
    });
  yoga = yogaFor(USER_ID);
  otherYoga = yogaFor(OTHER_USER_ID);
});

beforeEach(removeShareholders);

afterAll(async () => {
  if (!db) {
    return;
  }
  await removeShareholders();
  await withSuperuserClient(async client => {
    await client.query(`DELETE FROM ${qualifyTable('business_users')} WHERE user_id = ANY($1)`, [
      [USER_ID, OTHER_USER_ID],
    ]);
    await client.query(`DELETE FROM ${qualifyTable('businesses_admin')} WHERE id = ANY($1)`, [
      [OWNER_ID, OTHER_OWNER_ID],
    ]);
    const ids = [LINKED_BUSINESS_ID, OTHER_OWNER_ID, OWNER_ID];
    await client.query(
      `UPDATE ${qualifyTable('financial_entities')} SET owner_id = NULL WHERE id = ANY($1)`,
      [ids],
    );
    await client.query(`DELETE FROM ${qualifyTable('businesses')} WHERE id = ANY($1)`, [ids]);
    await client.query(`DELETE FROM ${qualifyTable('financial_entities')} WHERE id = ANY($1)`, [
      ids,
    ]);
  });
  await dropRlsRole(db.getPool());
});

describe('report 1214 shareholders', () => {
  it('round-trips a list: order, padding, trimming and numbers', async () => {
    const saved = await setShareholders(YEAR, [
      dana,
      { ...holdco, businessId: LINKED_BUSINESS_ID },
    ]);
    const read = await getShareholders(YEAR);

    expect(read).toEqual(saved);
    expect(read.map(s => s.fullName)).toEqual(['Dana Cohen', 'Holdco Ltd']);
    expect(read[0]).toMatchObject({
      year: YEAR,
      idNumber: '000000042',
      isControllingShareholder: true,
      dividendRightsPercent: 60,
      votingRightsPercent: 60.125,
      otherRightsPercent: null,
      isMaterialShareholder: true,
      salaryMonths1To9: 90_000,
      salaryMonths10To12: 30_000.5,
      otherPayments: 0,
      business: null,
    });
    expect(read[1]).toMatchObject({
      idNumber: '516123452',
      isMaterialShareholder: null,
      salaryMonths1To9: null,
      business: { id: LINKED_BUSINESS_ID, name: 'Shareholders linked holdco' },
    });
  });

  it("defaults to the caller's own business when no owner is given", async () => {
    await setShareholders(YEAR, [dana]);
    const read = await getShareholders(YEAR, null);
    expect(read.map(s => s.idNumber)).toEqual(['000000042']);
  });

  it('replaces the whole list on every set, in the new order', async () => {
    const [firstDana] = await setShareholders(YEAR, [dana, holdco]);
    await setShareholders(YEAR, [{ ...holdco, fullName: 'Holdco Renamed' }]);
    let read = await getShareholders(YEAR);
    expect(read.map(s => s.fullName)).toEqual(['Holdco Renamed']);
    expect(read.some(s => s.id === firstDana.id)).toBe(false);

    await setShareholders(YEAR, [holdco, dana]);
    read = await getShareholders(YEAR);
    expect(read.map(s => s.idNumber)).toEqual(['516123452', '000000042']);

    await setShareholders(YEAR, []);
    expect(await getShareholders(YEAR)).toEqual([]);
  });

  it('accepts several shareholders on the shared placeholder ID 999999964', async () => {
    const saved = await setShareholders(YEAR, [
      { idNumber: '999999964', fullName: 'Foreign One', isControllingShareholder: false },
      { idNumber: '999999964', fullName: 'Foreign Two', isControllingShareholder: false },
    ]);
    expect(saved.map(s => s.idNumber)).toEqual(['999999964', '999999964']);
    expect((await getShareholders(YEAR)).map(s => s.fullName)).toEqual([
      'Foreign One',
      'Foreign Two',
    ]);
  });

  it('rejects a repeated ordinary ID number with a friendly error, keeping the old list', async () => {
    await setShareholders(YEAR, [dana]);
    const error = await expectError(SET_SHAREHOLDERS_MUTATION, {
      ownerId: OWNER_ID,
      year: YEAR,
      shareholders: [holdco, { ...dana, idNumber: '000000042' }, { ...dana, fullName: 'Again' }],
    });
    expect(error.code).toBe('BAD_USER_INPUT');
    expect(error.message).toBe(
      'Shareholder row 2: ID number 000000042 is already used by shareholder row 1',
    );
    expect((await getShareholders(YEAR)).map(s => s.fullName)).toEqual(['Dana Cohen']);
  });

  it('rejects invalid rows before writing, naming the row', async () => {
    const cases: Array<[ShareholderInput, RegExp]> = [
      [{ ...dana, idNumber: '1234567890' }, /^Shareholder row 1: ID number/],
      [{ ...dana, idNumber: '12a' }, /^Shareholder row 1: ID number/],
      [{ ...dana, fullName: '   ' }, /^Shareholder row 1: full name/],
      [{ ...dana, dividendRightsPercent: 100.5 }, /^Shareholder row 1: dividendRightsPercent/],
      [{ ...dana, otherRightsPercent: -1 }, /^Shareholder row 1: otherRightsPercent/],
    ];
    for (const [badRow, message] of cases) {
      const error = await expectError(SET_SHAREHOLDERS_MUTATION, {
        ownerId: OWNER_ID,
        year: YEAR,
        shareholders: [holdco, badRow],
      });
      expect(error.code).toBe('BAD_USER_INPUT');
      expect(error.message).toMatch(message);
    }
    expect(await getShareholders(YEAR)).toEqual([]);
  });

  it('rejects a year outside 2000-2100', async () => {
    for (const year of [1999, 2101, 40_000]) {
      const error = await expectError(SHAREHOLDERS_QUERY, { ownerId: OWNER_ID, year });
      expect(error.code).toBe('BAD_USER_INPUT');
    }
  });

  it("rejects a linked business outside the owner's books", async () => {
    const error = await expectError(SET_SHAREHOLDERS_MUTATION, {
      ownerId: OWNER_ID,
      year: YEAR,
      shareholders: [{ ...holdco, businessId: OTHER_OWNER_ID }],
    });
    expect(error.code).toBe('BAD_USER_INPUT');
    expect(error.message).toMatch(/^Shareholder row 0: business /);
  });

  it("writes the caller's active business when no owner is given", async () => {
    const { setShareholders: saved } = await execute<{ setShareholders: Shareholder[] }>(
      SET_SHAREHOLDERS_MUTATION,
      { year: YEAR, shareholders: [dana] },
    );
    expect(saved.map(s => s.idNumber)).toEqual(['000000042']);
    expect(await getShareholders(YEAR)).toEqual(saved);
  });

  it('accepts upper-case UUIDs for the owner and the linked business', async () => {
    const { setShareholders: saved } = await execute<{ setShareholders: Shareholder[] }>(
      SET_SHAREHOLDERS_MUTATION,
      {
        ownerId: OWNER_ID.toUpperCase(),
        year: YEAR,
        shareholders: [{ ...holdco, businessId: LINKED_BUSINESS_ID.toUpperCase() }],
      },
    );
    expect(saved[0].businessId).toBe(LINKED_BUSINESS_ID);
    expect(saved[0].business?.id).toBe(LINKED_BUSINESS_ID);
    const read = await getShareholders(YEAR, OWNER_ID.toUpperCase());
    expect(read).toEqual(saved);
  });

  it("does not resolve a stored link to a business outside the owner's books", async () => {
    await withSuperuserClient(client =>
      client.query(
        `INSERT INTO ${qualifyTable('shareholders')} (owner_id, year, business_id, id_number, full_name)
         VALUES ($1, $2, $3, '000000007', 'Stray link')`,
        [OWNER_ID, YEAR, OTHER_OWNER_ID],
      ),
    );
    const [stray] = await getShareholders(YEAR);
    expect(stray).toMatchObject({ businessId: OTHER_OWNER_ID, business: null });
  });

  it('reports the first bad linked business in row order', async () => {
    const error = await expectError(SET_SHAREHOLDERS_MUTATION, {
      ownerId: OWNER_ID,
      year: YEAR,
      shareholders: [
        { ...dana, businessId: LINKED_BUSINESS_ID },
        { ...holdco, businessId: OTHER_OWNER_ID },
        { idNumber: '7', fullName: 'Third', isControllingShareholder: false, businessId: OWNER_ID },
      ],
    });
    expect(error.code).toBe('BAD_USER_INPUT');
    expect(error.message).toMatch(/^Shareholder row 1: business /);
  });

  describe('copyShareholdersFromYear', () => {
    it('copies into an empty year, keeping order and values', async () => {
      const source = await setShareholders(YEAR, [
        { ...holdco, businessId: LINKED_BUSINESS_ID },
        dana,
      ]);
      const { copyShareholdersFromYear: copied } = await execute<{
        copyShareholdersFromYear: Shareholder[];
      }>(COPY_SHAREHOLDERS_MUTATION, { ownerId: OWNER_ID, fromYear: YEAR, toYear: OTHER_YEAR });

      const strip = ({ id: _id, year: _year, ...rest }: Shareholder) => rest;
      expect(copied.map(strip)).toEqual(source.map(strip));
      expect(copied[0].businessId).toBe(LINKED_BUSINESS_ID);
      expect(copied.every(s => s.year === OTHER_YEAR)).toBe(true);
      expect(copied.some(s => source.some(src => src.id === s.id))).toBe(false);
      expect(await getShareholders(OTHER_YEAR)).toEqual(copied);
      // the source year is untouched
      expect(await getShareholders(YEAR)).toEqual(source);
    });

    it('returns an empty list when the source year has none', async () => {
      const { copyShareholdersFromYear: copied } = await execute<{
        copyShareholdersFromYear: Shareholder[];
      }>(COPY_SHAREHOLDERS_MUTATION, {
        ownerId: OWNER_ID,
        fromYear: EMPTY_YEAR,
        toYear: OTHER_YEAR,
      });
      expect(copied).toEqual([]);
    });

    it('rejects copying a year onto itself or to a year out of range', async () => {
      await setShareholders(YEAR, [dana]);
      const cases: Array<[number, number, RegExp]> = [
        [YEAR, YEAR, /must differ/],
        [YEAR, 2101, /^toYear /],
        [1999, YEAR, /^fromYear /],
      ];
      for (const [fromYear, toYear, message] of cases) {
        const error = await expectError(COPY_SHAREHOLDERS_MUTATION, {
          ownerId: OWNER_ID,
          fromYear,
          toYear,
        });
        expect(error.code).toBe('BAD_USER_INPUT');
        expect(error.message).toMatch(message);
      }
      expect((await getShareholders(YEAR)).map(s => s.fullName)).toEqual(['Dana Cohen']);
    });

    it('refuses to copy into a year that already has shareholders', async () => {
      await setShareholders(YEAR, [dana]);
      await setShareholders(OTHER_YEAR, [holdco]);
      const error = await expectError(COPY_SHAREHOLDERS_MUTATION, {
        ownerId: OWNER_ID,
        fromYear: YEAR,
        toYear: OTHER_YEAR,
      });
      expect(error.code).toBe('SHAREHOLDERS_TARGET_YEAR_NOT_EMPTY');
      expect((await getShareholders(OTHER_YEAR)).map(s => s.fullName)).toEqual(['Holdco Ltd']);
    });
  });

  describe('tenant isolation', () => {
    it("forbids another tenant's user from reading or writing the owner's shareholders", async () => {
      await setShareholders(YEAR, [dana]);

      const read = await expectError(SHAREHOLDERS_QUERY, { ownerId: OWNER_ID, year: YEAR }, otherYoga);
      expect(read.code).toBe('FORBIDDEN');

      const write = await expectError(
        SET_SHAREHOLDERS_MUTATION,
        { ownerId: OWNER_ID, year: YEAR, shareholders: [] },
        otherYoga,
      );
      expect(write.code).toBe('FORBIDDEN');

      const copy = await expectError(
        COPY_SHAREHOLDERS_MUTATION,
        { ownerId: OWNER_ID, fromYear: YEAR, toYear: OTHER_YEAR },
        otherYoga,
      );
      expect(copy.code).toBe('FORBIDDEN');

      expect((await getShareholders(YEAR)).map(s => s.fullName)).toEqual(['Dana Cohen']);
    });

    it('refuses a write to a business of the user other than the active one', async () => {
      // A second, older membership: the admin business stays the active (most recent) one
      await withSuperuserClient(client =>
        client.query(
          `INSERT INTO ${qualifyTable('business_users')} (user_id, business_id, role_id, updated_at)
           VALUES ($1, $2, 'business_owner', now() - interval '1 day')
           ON CONFLICT DO NOTHING`,
          [USER_ID, OTHER_OWNER_ID],
        ),
      );
      try {
        // reading the other membership is fine
        expect(await getShareholders(YEAR, OTHER_OWNER_ID)).toEqual([]);

        const write = await expectError(SET_SHAREHOLDERS_MUTATION, {
          ownerId: OTHER_OWNER_ID,
          year: YEAR,
          shareholders: [],
        });
        expect(write.code).toBe('FORBIDDEN');
        expect(write.message).toMatch(/^Switch the active business to /);

        const copy = await expectError(COPY_SHAREHOLDERS_MUTATION, {
          ownerId: OTHER_OWNER_ID,
          fromYear: YEAR,
          toYear: OTHER_YEAR,
        });
        expect(copy.code).toBe('FORBIDDEN');
      } finally {
        await withSuperuserClient(client =>
          client.query(
            `DELETE FROM ${qualifyTable('business_users')} WHERE user_id = $1 AND business_id = $2`,
            [USER_ID, OTHER_OWNER_ID],
          ),
        );
      }
    });

    it("hides the owner's rows from another tenant's RLS scope", async () => {
      await setShareholders(YEAR, [dana]);

      const visibleOwners = async (scopeOwnerId: string) => {
        const client = await db.getPool().connect();
        try {
          await client.query('BEGIN');
          await client.query(
            `SELECT set_config('app.current_business_id', $1, true),
                    set_config('app.current_business_scope', $2, true)`,
            [scopeOwnerId, `{${scopeOwnerId}}`],
          );
          return await runAsRlsRole(client, async () => {
            const result = await client.query<{ owner_id: string }>(
              `SELECT owner_id FROM accounter_schema.shareholders WHERE year = $1`,
              [YEAR],
            );
            return result.rows.map(row => row.owner_id);
          });
        } finally {
          await client.query('ROLLBACK');
          client.release();
        }
      };

      expect(await visibleOwners(OWNER_ID)).toEqual([OWNER_ID]);
      expect(await visibleOwners(OTHER_OWNER_ID)).toEqual([]);
    });

    it("rejects writes to the owner's rows from another write target, even with both in scope", async () => {
      await setShareholders(YEAR, [dana]);

      const client = await db.getPool().connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `SELECT set_config('app.current_business_id', $1, true),
                  set_config('app.current_business_scope', $2, true)`,
          [OTHER_OWNER_ID, `{${OWNER_ID},${OTHER_OWNER_ID}}`],
        );
        const pgCode = (error: unknown) => (error as { code?: string }).code;

        // insert a row for the owner: the WITH CHECK policy rejects it
        const insert = await runAsRlsRole(client, () =>
          client.query(
            `INSERT INTO accounter_schema.shareholders (owner_id, year, id_number, full_name)
             VALUES ($1, $2, '000000099', 'Intruder')`,
            [OWNER_ID, YEAR],
          ),
        ).catch(error => error);
        expect(pgCode(insert)).toBe('42501');

        // delete the owner's rows: visible through the read scope, but the restrictive delete
        // policy filters them out
        const deleted = await runAsRlsRole(client, () =>
          client.query(
            `DELETE FROM accounter_schema.shareholders WHERE owner_id = $1 AND year = $2`,
            [OWNER_ID, YEAR],
          ),
        );
        expect(deleted.rowCount).toBe(0);

        // a copy-style INSERT ... SELECT into the owner's books fails as well
        const copy = await runAsRlsRole(client, () =>
          client.query(
            `INSERT INTO accounter_schema.shareholders (owner_id, year, id_number, full_name)
             SELECT owner_id, $2, id_number, full_name
             FROM accounter_schema.shareholders WHERE owner_id = $1 AND year = $3`,
            [OWNER_ID, OTHER_YEAR, YEAR],
          ),
        ).catch(error => error);
        expect(pgCode(copy)).toBe('42501');
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }

      expect((await getShareholders(YEAR)).map(s => s.fullName)).toEqual(['Dana Cohen']);
    });
  });
});
