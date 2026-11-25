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
 * Form 1214 profile API end to end: `report1214Profile` and `updateReport1214Profile` through the
 * real application (`createGraphQLApp`) with dev-bypass identities, plus the
 * `report_1214_profiles` RLS policy evaluated under a non-superuser role.
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
                throw new Error(`${String(key)} is stubbed in the 1214 profile test`);
              },
      },
    ),
);
vi.mock('@accounter/green-invoice-graphql', unbuiltPackageStub);
vi.mock('@accounter/shaam-uniform-format-generator', unbuiltPackageStub);

const ADMIN_ID = makeUUID('business', 'Admin Business');
const USER_ID = makeUUID('user', 'report-1214-profile-user');
/** A second tenant, with its own user, that must not see the admin's profile */
const OTHER_OWNER_ID = makeUUID('business', 'report-1214-profile-other-owner');
const OTHER_USER_ID = makeUUID('user', 'report-1214-profile-other-user');

/** A year without a generator layout: amount codes are checked against the latest supported one */
const YEAR = 2094;
/** A second, untouched year of the suite, for the empty-input insert */
const EMPTY_INPUT_YEAR = 2095;

const PROFILE_FIELDS = /* GraphQL */ `
  id
  ownerId
  year
  company {
    registeredName
    phone {
      prefix
      number
    }
    fax {
      prefix
      number
    }
    email
    occupationDescription
    mailingAddress
    businessAddress
    booksAddress
    withholdingFileNumber
  }
  declarations {
    hasTaxPlanningAction
    hadRelatedPartyTransactions
    controlsBodyOfPersons
    holdsRightsInBodyOfPersons
    appliesAccountingStandards
    directorsReceivedOpinion
    tookReportablePosition
    reportablePositions
    form6111Obligation
    financialStatementsAttached
    familyCompany {
      representativeFileNumber
    }
    isHouseCompany
    form1343Attached
    form1344Attached
    claimsCapitalInvestmentLawBenefits
    preferredEnterprise
    beneficiaryEnterprise {
      noticeDate
    }
    dividendDistributed
    specialYear {
      balanceSheetDate
    }
    foreignInvestors
    consolidatedReport
    partnerInPartnership
    isKibbutz
    requestsAdvancePayments
    hasBuildingIncome
    isTrustBeneficiary
    nonDeductibleSalaryExpenses
    fewMembersCompany62A
    partOfMultinationalGroup
    noBankAccount
    hasCapitalGainsAppendix
  }
  preparer {
    officeName
    name
    licensedDealerNumber
    phone {
      prefix
      number
    }
  }
  attachments {
    donationReceiptsCount
    withholdingCertificatesCount
  }
  bankAccount {
    bank
    branch
    account
  }
  otherTaxableIncome {
    source
    amount
    ratePercent
  }
  capitalGainsSummary {
    totalAppendicesCount
    untransmittedCount
    reasons {
      other
      otherText
    }
  }
  qualifyingCompany {
    purchased
    israeliPurchaseAmount
  }
  relatedCompanies {
    companyName
    companyFileNumber
    relationType
    assessingOfficeCode
  }
  rdInvestments {
    companyName
    companyFileNumber
    investmentAmount
  }
  amountOverrides {
    code
    amount
  }
  updatedAt
`;

const PROFILE_QUERY = /* GraphQL */ `
  query Report1214ProfileTest($ownerId: UUID, $year: Int!) {
    report1214Profile(ownerId: $ownerId, year: $year) {
      ${PROFILE_FIELDS}
    }
  }
`;

const UPDATE_PROFILE_MUTATION = /* GraphQL */ `
  mutation Report1214UpdateProfileTest(
    $ownerId: UUID
    $year: Int!
    $input: Report1214ProfileInput!
  ) {
    updateReport1214Profile(ownerId: $ownerId, year: $year, input: $input) {
      ${PROFILE_FIELDS}
    }
  }
`;

type Profile = Record<string, unknown> & {
  id: string;
  ownerId: string;
  year: number;
  company: Record<string, unknown>;
  declarations: Record<string, unknown>;
  preparer: Record<string, unknown> | null;
  bankAccount: Record<string, unknown> | null;
  relatedCompanies: unknown[];
  rdInvestments: unknown[];
  amountOverrides: Array<{ code: string; amount: number }>;
  updatedAt: string | null;
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

const getProfile = (year = YEAR, ownerId: string | null = ADMIN_ID) =>
  execute<{ report1214Profile: Profile }>(PROFILE_QUERY, { ownerId, year }).then(
    data => data.report1214Profile,
  );

const updateProfile = (input: Record<string, unknown>, year = YEAR) =>
  execute<{ updateReport1214Profile: Profile }>(UPDATE_PROFILE_MUTATION, {
    ownerId: ADMIN_ID,
    year,
    input,
  }).then(data => data.updateReport1214Profile);

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
    await client.query("SELECT set_config('app.current_business_id', $1, true)", [ADMIN_ID]);
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

async function removeProfiles() {
  await withSuperuserClient(client =>
    client.query(
      `DELETE FROM ${qualifyTable('report_1214_profiles')}
       WHERE owner_id = ANY($1) AND year BETWEEN 2091 AND 2099`,
      [[ADMIN_ID, OTHER_OWNER_ID]],
    ),
  );
}

/** The raw JSONB blocks of the admin's profile row of `year` */
async function rawRow(year: number) {
  const rows = await withSuperuserClient(client =>
    client
      .query(
        `SELECT company, declarations, preparer, attachments, bank_account, other_taxable_income,
                capital_gains_summary, qualifying_company, related_companies, rd_investments,
                amount_overrides
         FROM ${qualifyTable('report_1214_profiles')} WHERE owner_id = $1 AND year = $2`,
        [ADMIN_ID, year],
      )
      .then(result => result.rows),
  );
  expect(rows).toHaveLength(1);
  return rows[0];
}

const fullDeclarations = {
  hasTaxPlanningAction: false,
  hadRelatedPartyTransactions: true,
  controlsBodyOfPersons: false,
  holdsRightsInBodyOfPersons: true,
  appliesAccountingStandards: false,
  directorsReceivedOpinion: true,
  tookReportablePosition: true,
  reportablePositions: [12, 345],
  form6111Obligation: 'NOT_RELEVANT',
  financialStatementsAttached: true,
  familyCompany: { representativeFileNumber: '123456782' },
  isHouseCompany: false,
  form1343Attached: true,
  form1344Attached: false,
  claimsCapitalInvestmentLawBenefits: true,
  preferredEnterprise: false,
  beneficiaryEnterprise: { noticeDate: '2094-03-15' },
  dividendDistributed: true,
  specialYear: { balanceSheetDate: '2094-06-30' },
  foreignInvestors: false,
  consolidatedReport: 'CONSOLIDATES_WITH_PARENT',
  partnerInPartnership: true,
  isKibbutz: false,
  requestsAdvancePayments: true,
  hasBuildingIncome: false,
  isTrustBeneficiary: true,
  nonDeductibleSalaryExpenses: false,
  fewMembersCompany62A: true,
  partOfMultinationalGroup: false,
  noBankAccount: true,
  hasCapitalGainsAppendix: false,
};

beforeAll(async () => {
  db = new TestDatabase();
  await db.connect();
  await db.ensureLatestSchema();
  await db.seedAdmin();
  await ensureRlsRole(db.getPool(), {
    // the role is per worker and dropped with its grants in afterAll (dropRlsRole)
    grants: [{ table: 'report_1214_profiles', privileges: 'SELECT, INSERT, UPDATE' }],
  });

  await withSuperuserClient(async client => {
    // `business_users` references `businesses_admin`: make sure the shared admin row exists
    await client.query(
      `INSERT INTO ${qualifyTable('businesses_admin')} (id, owner_id) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [ADMIN_ID],
    );
    await client.query(
      `INSERT INTO ${qualifyTable('business_users')} (user_id, business_id, role_id)
       VALUES ($1, $2, 'business_owner') ON CONFLICT DO NOTHING`,
      [USER_ID, ADMIN_ID],
    );

    await client.query(
      `INSERT INTO ${qualifyTable('financial_entities')} (id, name, type, owner_id)
       VALUES ($1, 'Profile other owner', 'business', NULL) ON CONFLICT (id) DO NOTHING`,
      [OTHER_OWNER_ID],
    );
    await client.query(
      `INSERT INTO ${qualifyTable('businesses')} (id, country, owner_id)
       VALUES ($1, 'ISR', $1) ON CONFLICT (id) DO NOTHING`,
      [OTHER_OWNER_ID],
    );
    await client.query(
      `UPDATE ${qualifyTable('financial_entities')} SET owner_id = $1 WHERE id = $1`,
      [OTHER_OWNER_ID],
    );
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

beforeEach(removeProfiles);

afterAll(async () => {
  if (!db) {
    return;
  }
  await removeProfiles();
  await withSuperuserClient(async client => {
    await client.query(`DELETE FROM ${qualifyTable('business_users')} WHERE user_id = ANY($1)`, [
      [USER_ID, OTHER_USER_ID],
    ]);
    await client.query(`DELETE FROM ${qualifyTable('businesses_admin')} WHERE id = $1`, [
      OTHER_OWNER_ID,
    ]);
    await client.query(
      `UPDATE ${qualifyTable('financial_entities')} SET owner_id = NULL WHERE id = $1`,
      [OTHER_OWNER_ID],
    );
    await client.query(`DELETE FROM ${qualifyTable('businesses')} WHERE id = $1`, [
      OTHER_OWNER_ID,
    ]);
    await client.query(`DELETE FROM ${qualifyTable('financial_entities')} WHERE id = $1`, [
      OTHER_OWNER_ID,
    ]);
  });
  await dropRlsRole(db.getPool());
});

describe('report 1214 profile', () => {
  it('returns an empty default profile when nothing is stored', async () => {
    const profile = await getProfile();
    expect(profile).toMatchObject({
      id: `${ADMIN_ID}:${YEAR}`,
      ownerId: ADMIN_ID,
      year: YEAR,
      preparer: null,
      attachments: null,
      bankAccount: null,
      otherTaxableIncome: null,
      capitalGainsSummary: null,
      qualifyingCompany: null,
      relatedCompanies: [],
      rdInvestments: [],
      amountOverrides: [],
      updatedAt: null,
    });
    expect(Object.values(profile.company).every(value => value === null)).toBe(true);
    expect(Object.values(profile.declarations).every(value => value === null)).toBe(true);
  });

  it("defaults to the caller's active business when no owner is given", async () => {
    await updateProfile({ company: { email: 'office@example.com' } });
    const profile = await getProfile(YEAR, null);
    expect(profile.ownerId).toBe(ADMIN_ID);
    expect(profile.company.email).toBe('office@example.com');
  });

  it('round-trips every block, including a full declarations block', async () => {
    const saved = await updateProfile({
      company: {
        registeredName: ' Acme Ltd ',
        phone: { prefix: '03', number: '1234567' },
        fax: { prefix: '077', number: '7654321' },
        email: 'office@example.com',
        occupationDescription: 'Software',
        mailingAddress: '1 Main St',
        businessAddress: '2 Main St',
        booksAddress: '3 Main St',
        withholdingFileNumber: '951400001',
      },
      declarations: fullDeclarations,
      preparer: {
        officeName: 'CPA Office',
        name: 'Avi',
        licensedDealerNumber: '12345',
        phone: { prefix: '054', number: '1112223' },
      },
      attachments: { donationReceiptsCount: 2, withholdingCertificatesCount: 0 },
      bankAccount: { bank: '12', branch: '345', account: '678901' },
      otherTaxableIncome: { source: 'Royalties', amount: 1000, ratePercent: 23 },
      capitalGainsSummary: {
        totalAppendicesCount: 3,
        untransmittedCount: 1,
        reasons: { other: true, otherText: 'Late statement' },
      },
      qualifyingCompany: { purchased: true, israeliPurchaseAmount: 500_000 },
      relatedCompanies: [
        { companyName: 'Sub Ltd', companyFileNumber: '12', relationType: 'SUBSIDIARY' },
        { companyName: 'Parent Ltd', relationType: 'PARENT', assessingOfficeCode: 34 },
      ],
      rdInvestments: [{ companyName: 'Lab Ltd', investmentAmount: 25_000 }],
      amountOverrides: [
        { code: '081', amount: 2000 },
        { code: '072', amount: 150_000 },
      ],
    });

    expect(saved.declarations).toEqual(fullDeclarations);
    expect(saved.company).toEqual({
      registeredName: 'Acme Ltd',
      phone: { prefix: '03', number: '1234567' },
      fax: { prefix: '077', number: '7654321' },
      email: 'office@example.com',
      occupationDescription: 'Software',
      mailingAddress: '1 Main St',
      businessAddress: '2 Main St',
      booksAddress: '3 Main St',
      withholdingFileNumber: '951400001',
    });
    expect(saved).toMatchObject({
      bankAccount: { bank: '12', branch: '345', account: '678901' },
      relatedCompanies: [
        {
          companyName: 'Sub Ltd',
          companyFileNumber: '12',
          relationType: 'SUBSIDIARY',
          assessingOfficeCode: null,
        },
        {
          companyName: 'Parent Ltd',
          companyFileNumber: null,
          relationType: 'PARENT',
          assessingOfficeCode: 34,
        },
      ],
      rdInvestments: [{ companyName: 'Lab Ltd', companyFileNumber: null, investmentAmount: 25_000 }],
      amountOverrides: [
        { code: '072', amount: 150_000 },
        { code: '081', amount: 2000 },
      ],
    });
    expect(saved.updatedAt).not.toBeNull();
    expect(await getProfile()).toEqual(saved);

    // stored in the generator's input shape
    const [row] = await withSuperuserClient(client =>
      client
        .query(
          `SELECT declarations, related_companies, amount_overrides, company
           FROM ${qualifyTable('report_1214_profiles')} WHERE owner_id = $1 AND year = $2`,
          [ADMIN_ID, YEAR],
        )
        .then(result => result.rows),
    );
    expect(row.declarations).toMatchObject({
      form6111Obligation: 'notRelevant',
      consolidatedReport: 'consolidatesWithParent',
      beneficiaryEnterprise: { noticeDate: '2094-03-15' },
    });
    expect(row.related_companies).toEqual([
      { companyName: 'Sub Ltd', companyFileNumber: '12', relationType: 'subsidiary' },
      { companyName: 'Parent Ltd', relationType: 'parent', assessingOfficeCode: 34 },
    ]);
    expect(row.amount_overrides).toEqual({ '072': 150_000, '081': 2000 });
    expect(row.company).not.toHaveProperty('fileNumber');
  });

  it('keeps omitted blocks on a partial update and replaces provided ones whole', async () => {
    await updateProfile({
      company: { email: 'office@example.com', mailingAddress: '1 Main St' },
      declarations: { isKibbutz: true, hasTaxPlanningAction: false },
      relatedCompanies: [{ companyName: 'Sub Ltd', relationType: 'SUBSIDIARY' }],
      amountOverrides: [{ code: '072', amount: 1 }],
    });

    const updated = await updateProfile({ company: { email: 'new@example.com' } });
    // the provided block replaces the stored one entirely
    expect(updated.company).toMatchObject({ email: 'new@example.com', mailingAddress: null });
    // the omitted blocks stay
    expect(updated.declarations).toMatchObject({ isKibbutz: true, hasTaxPlanningAction: false });
    expect(updated.relatedCompanies).toHaveLength(1);
    expect(updated.amountOverrides).toEqual([{ code: '072', amount: 1 }]);
    expect(await getProfile()).toEqual(updated);
  });

  it('clears a block given an explicit null', async () => {
    await updateProfile({
      preparer: { name: 'Avi' },
      bankAccount: { bank: '12', branch: '345', account: '1' },
      relatedCompanies: [{ companyName: 'Sub Ltd', relationType: 'SUBSIDIARY' }],
      amountOverrides: [{ code: '072', amount: 1 }],
      declarations: { isKibbutz: true },
    });

    const cleared = await updateProfile({
      preparer: null,
      bankAccount: null,
      relatedCompanies: null,
      amountOverrides: null,
    });
    expect(cleared).toMatchObject({
      preparer: null,
      bankAccount: null,
      relatedCompanies: [],
      amountOverrides: [],
    });
    expect(cleared.declarations.isKibbutz).toBe(true);

    const [row] = await withSuperuserClient(client =>
      client
        .query(
          `SELECT preparer, bank_account, related_companies, amount_overrides
           FROM ${qualifyTable('report_1214_profiles')} WHERE owner_id = $1 AND year = $2`,
          [ADMIN_ID, YEAR],
        )
        .then(result => result.rows),
    );
    expect(row).toEqual({
      preparer: {},
      bank_account: {},
      related_companies: [],
      amount_overrides: {},
    });
  });

  it('rejects invalid input before writing', async () => {
    await updateProfile({ company: { email: 'office@example.com' } });
    const cases: Array<[Record<string, unknown>, RegExp]> = [
      [{ company: { phone: { prefix: '051', number: '1234567' } } }, /company\.phone\.prefix/],
      [{ company: { phone: { prefix: '03', number: '123' } } }, /company\.phone\.number/],
      [{ amountOverrides: [{ code: '008', amount: 1 }] }, /code 008 is derived/],
      [{ amountOverrides: [{ code: '999', amount: 1 }] }, /not a record 1000 input code/],
      [
        {
          amountOverrides: [
            { code: '072', amount: 1 },
            { code: '072', amount: 2 },
          ],
        },
        /appears more than once/,
      ],
      [
        {
          rdInvestments: Array.from({ length: 51 }, () => ({
            companyName: 'X',
            investmentAmount: 1,
          })),
        },
        /^rdInvestments exceeds the size limit of 50 items/,
      ],
    ];
    for (const [input, message] of cases) {
      const error = await expectError(UPDATE_PROFILE_MUTATION, {
        ownerId: ADMIN_ID,
        year: YEAR,
        input: { ...input, company: input.company ?? { email: 'changed@example.com' } },
      });
      expect(error.code).toBe('BAD_USER_INPUT');
      expect(error.message).toMatch(message);
    }
    expect((await getProfile()).company.email).toBe('office@example.com');
  });

  it('stores a list over the form limit as is, for the report validation to flag', async () => {
    const saved = await updateProfile({
      relatedCompanies: Array.from({ length: 4 }, (_, i) => ({
        companyName: `Related ${i}`,
        relationType: 'OTHER',
      })),
      rdInvestments: Array.from({ length: 6 }, (_, i) => ({
        companyName: `Lab ${i}`,
        investmentAmount: 1000,
      })),
      declarations: { reportablePositions: [1, 2, 3, 4, 5, 6] },
    });
    expect(saved.relatedCompanies).toHaveLength(4);
    expect(saved.rdInvestments).toHaveLength(6);
    expect(saved.declarations.reportablePositions).toEqual([1, 2, 3, 4, 5, 6]);
    expect(await getProfile()).toEqual(saved);
  });

  it('checks amount codes against the layout of a supported year (2025)', async () => {
    // Rejections only: nothing is written, so the suite never touches a real tax year's row
    const unknown = await expectError(UPDATE_PROFILE_MUTATION, {
      ownerId: ADMIN_ID,
      year: 2025,
      input: { amountOverrides: [{ code: '999', amount: 1 }] },
    });
    expect(unknown.code).toBe('BAD_USER_INPUT');
    expect(unknown.message).toMatch(/is not a record 1000 input code of the 2025 layout/);

    const derived = await expectError(UPDATE_PROFILE_MUTATION, {
      ownerId: ADMIN_ID,
      year: 2025,
      input: { amountOverrides: [{ code: '297', amount: 8 }] },
    });
    expect(derived.code).toBe('BAD_USER_INPUT');
    expect(derived.message).toMatch(/code 297 is derived/);
  });

  it('fills the omitted blocks of a fresh partial insert with the column defaults', async () => {
    await updateProfile({ company: { email: 'office@example.com' } });
    expect(await rawRow(YEAR)).toEqual({
      company: { email: 'office@example.com' },
      declarations: {},
      preparer: {},
      attachments: {},
      bank_account: {},
      other_taxable_income: {},
      capital_gains_summary: {},
      qualifying_company: {},
      related_companies: [],
      rd_investments: [],
      amount_overrides: {},
    });
  });

  it('creates an empty row for an empty input on a fresh owner and year', async () => {
    // Intended: saving an empty input still records that the profile was saved (updatedAt)
    const saved = await updateProfile({}, EMPTY_INPUT_YEAR);
    expect(saved.updatedAt).not.toBeNull();
    expect(saved).toMatchObject({ preparer: null, relatedCompanies: [], amountOverrides: [] });
    expect(await rawRow(EMPTY_INPUT_YEAR)).toEqual({
      company: {},
      declarations: {},
      preparer: {},
      attachments: {},
      bank_account: {},
      other_taxable_income: {},
      capital_gains_summary: {},
      qualifying_company: {},
      related_companies: [],
      rd_investments: [],
      amount_overrides: {},
    });
  });

  it('rejects a year outside 2000-2100', async () => {
    for (const year of [1999, 2101, 40_000]) {
      const error = await expectError(PROFILE_QUERY, { ownerId: ADMIN_ID, year });
      expect(error.code).toBe('BAD_USER_INPUT');
      const write = await expectError(UPDATE_PROFILE_MUTATION, {
        ownerId: ADMIN_ID,
        year,
        input: {},
      });
      expect(write.code).toBe('BAD_USER_INPUT');
    }
  });

  describe('tenant isolation', () => {
    it("forbids another tenant's user from reading or writing the owner's profile", async () => {
      await updateProfile({ company: { email: 'office@example.com' } });

      const read = await expectError(PROFILE_QUERY, { ownerId: ADMIN_ID, year: YEAR }, otherYoga);
      expect(read.code).toBe('FORBIDDEN');

      const write = await expectError(
        UPDATE_PROFILE_MUTATION,
        { ownerId: ADMIN_ID, year: YEAR, input: { company: null } },
        otherYoga,
      );
      expect(write.code).toBe('FORBIDDEN');

      // access is checked before the input, so invalid input is FORBIDDEN as well
      const invalidWrite = await expectError(
        UPDATE_PROFILE_MUTATION,
        { ownerId: ADMIN_ID, year: YEAR, input: { amountOverrides: [{ code: '008', amount: 1 }] } },
        otherYoga,
      );
      expect(invalidWrite.code).toBe('FORBIDDEN');

      expect((await getProfile()).company.email).toBe('office@example.com');
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
        expect((await getProfile(YEAR, OTHER_OWNER_ID)).ownerId).toBe(OTHER_OWNER_ID);

        const write = await expectError(UPDATE_PROFILE_MUTATION, {
          ownerId: OTHER_OWNER_ID,
          year: YEAR,
          input: { company: { email: 'x@example.com' } },
        });
        expect(write.code).toBe('FORBIDDEN');
        expect(write.message).toMatch(/^Switch the active business to /);
      } finally {
        await withSuperuserClient(client =>
          client.query(
            `DELETE FROM ${qualifyTable('business_users')} WHERE user_id = $1 AND business_id = $2`,
            [USER_ID, OTHER_OWNER_ID],
          ),
        );
      }
      const [{ count }] = await withSuperuserClient(client =>
        client
          .query<{ count: string }>(
            `SELECT count(*) FROM ${qualifyTable('report_1214_profiles')} WHERE owner_id = $1`,
            [OTHER_OWNER_ID],
          )
          .then(result => result.rows),
      );
      expect(Number(count)).toBe(0);
    });

    it("hides the owner's row from another tenant's RLS scope", async () => {
      await updateProfile({ company: { email: 'office@example.com' } });

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
              `SELECT owner_id FROM accounter_schema.report_1214_profiles WHERE year = $1`,
              [YEAR],
            );
            return result.rows.map(row => row.owner_id);
          });
        } finally {
          await client.query('ROLLBACK');
          client.release();
        }
      };

      expect(await visibleOwners(ADMIN_ID)).toEqual([ADMIN_ID]);
      expect(await visibleOwners(OTHER_OWNER_ID)).toEqual([]);
    });
  });
});
