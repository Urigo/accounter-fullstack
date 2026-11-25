import { createRequire } from 'node:module';
import { createYoga } from 'graphql-yoga';
import type { PoolClient } from 'pg';
import { useSchema } from '@envelop/core';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { decode } from 'iconv-lite';
import { parse1214 } from '@accounter/opcn1214-generator';
import { makeUUID } from '../demo-fixtures/helpers/deterministic-uuid.js';
import { env } from '../environment.js';
import { createGraphQLApp } from '../modules-app.js';
import { dbCleanupPlugin } from '../plugins/db-cleanup-plugin.js';
import { TestDatabase } from './helpers/db-setup.js';
import { qualifyTable } from './helpers/test-db-config.js';

/**
 * Form 1214 report end to end: business identity in the books, profile and shareholders set
 * through the mutations, then `report1214` → validation and the file to upload, through the real
 * application (`createGraphQLApp`) with dev-bypass identities.
 *
 * The report owner is a company of its own (with its own user), so the suite can use a real tax
 * year (2024) without touching the shared admin business.
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
                throw new Error(`${String(key)} is stubbed in the 1214 report test`);
              },
      },
    ),
);
vi.mock('@accounter/green-invoice-graphql', unbuiltPackageStub);
vi.mock('@accounter/shaam-uniform-format-generator', unbuiltPackageStub);

const OWNER_ID = makeUUID('business', 'report-1214-owner');
const OWNER_USER_ID = makeUUID('user', 'report-1214-owner-user');
/** Another tenant (the shared admin business), whose user must not see the owner's report */
const ADMIN_ID = makeUUID('business', 'Admin Business');
const ADMIN_USER_ID = makeUUID('user', 'report-1214-admin-user');

const YEAR = 2024;
/** A valid company number and its withholding file number (9 + first 7 digits + check digit) */
const COMPANY_NUMBER = '514000009';
const WITHHOLDING_FILE_NUMBER = '951400001';

const REPORT_QUERY = /* GraphQL */ `
  query Report1214Test($ownerId: UUID, $year: Int!) {
    report1214(ownerId: $ownerId, year: $year) {
      id
      year
      owner {
        id
      }
      profile {
        id
      }
      shareholders {
        idNumber
      }
      validation {
        isValid
        errors {
          ruleId
          path
          severity
        }
        warnings {
          ruleId
        }
      }
      file {
        fileName
        encodedContent
        omittedZeroCodes
      }
    }
  }
`;

const VALIDATION_QUERY = /* GraphQL */ `
  query Report1214ValidationTest($ownerId: UUID, $year: Int!) {
    report1214(ownerId: $ownerId, year: $year) {
      validation {
        isValid
        errors {
          ruleId
          path
          severity
        }
      }
    }
  }
`;

const AMOUNTS_QUERY = /* GraphQL */ `
  query Report1214AmountsTest($ownerId: UUID, $year: Int!) {
    report1214(ownerId: $ownerId, year: $year) {
      amounts {
        code
        amount
        source
        computedAmount
        label
      }
      validation {
        isValid
        errors {
          ruleId
          path
          severity
        }
        warnings {
          ruleId
        }
      }
      file {
        encodedContent
      }
    }
  }
`;

const UPDATE_PROFILE_MUTATION = /* GraphQL */ `
  mutation Report1214ReportUpdateProfile(
    $ownerId: UUID
    $year: Int!
    $input: Report1214ProfileInput!
  ) {
    updateReport1214Profile(ownerId: $ownerId, year: $year, input: $input) {
      id
    }
  }
`;

const SET_SHAREHOLDERS_MUTATION = /* GraphQL */ `
  mutation Report1214ReportSetShareholders(
    $ownerId: UUID
    $year: Int!
    $shareholders: [ShareholderInput!]!
  ) {
    setShareholders(ownerId: $ownerId, year: $year, shareholders: $shareholders) {
      id
    }
  }
`;

type Issue = { ruleId: string; path: string | null; severity: 'ERROR' | 'WARNING' };
type Report = {
  id: string;
  year: number;
  owner: { id: string };
  profile: { id: string };
  shareholders: Array<{ idNumber: string }>;
  validation: { isValid: boolean; errors: Issue[]; warnings: Array<{ ruleId: string }> };
  file: { fileName: string; encodedContent: string; omittedZeroCodes: string[] } | null;
};

type AmountRow = {
  code: string;
  amount: number;
  source: 'COMPUTED' | 'OVERRIDE';
  computedAmount: number | null;
  label: string | null;
};
type AmountsReport = Pick<Report, 'validation'> & {
  amounts: AmountRow[];
  file: { encodedContent: string } | null;
};

type GraphQLResponse<T> = {
  data?: T | null;
  errors?: Array<{ message: string; path?: string[]; extensions?: { code?: string } }>;
};

let db: TestDatabase;
let yoga: { fetch: (url: string, init: RequestInit) => Response | Promise<Response> };
let adminYoga: typeof yoga;

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

const updateProfile = (input: Record<string, unknown>) =>
  execute(UPDATE_PROFILE_MUTATION, { ownerId: OWNER_ID, year: YEAR, input });

const setShareholders = (shareholders: Array<Record<string, unknown>>) =>
  execute(SET_SHAREHOLDERS_MUTATION, { ownerId: OWNER_ID, year: YEAR, shareholders });

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

async function removeReportData() {
  await withSuperuserClient(async client => {
    await client.query(`DELETE FROM ${qualifyTable('report_1214_profiles')} WHERE owner_id = $1`, [
      OWNER_ID,
    ]);
    await client.query(`DELETE FROM ${qualifyTable('shareholders')} WHERE owner_id = $1`, [
      OWNER_ID,
    ]);
  });
}

const completeProfile = {
  company: {
    occupationDescription: 'פיתוח תוכנה',
    email: 'tax@example.com',
  },
  declarations: {
    hasTaxPlanningAction: false,
    hadRelatedPartyTransactions: true,
    controlsBodyOfPersons: false,
    holdsRightsInBodyOfPersons: false,
    appliesAccountingStandards: false,
    directorsReceivedOpinion: false,
    tookReportablePosition: false,
  },
  amountOverrides: [
    { code: '018', amount: 4 },
    { code: '072', amount: 0 },
    { code: '081', amount: 1000 },
    { code: '094', amount: 0 },
    { code: '263', amount: 1 },
  ],
};

const shareholdersInput = [
  {
    idNumber: '123456782',
    fullName: 'ישראל ישראלי',
    isControllingShareholder: true,
    dividendRightsPercent: 60,
    votingRightsPercent: 60,
  },
  {
    idNumber: '18',
    fullName: 'שרה כהן',
    isControllingShareholder: false,
    dividendRightsPercent: 40,
    votingRightsPercent: 40,
  },
];

beforeAll(async () => {
  db = new TestDatabase();
  await db.connect();
  await db.ensureLatestSchema();
  await db.seedAdmin();

  await withSuperuserClient(async client => {
    await client.query(
      `INSERT INTO ${qualifyTable('financial_entities')} (id, name, type, owner_id)
       VALUES ($1, 'Report 1214 Ltd', 'business', NULL) ON CONFLICT (id) DO NOTHING`,
      [OWNER_ID],
    );
    await client.query(
      `INSERT INTO ${qualifyTable('businesses')}
         (id, country, owner_id, vat_number, hebrew_name, address_hebrew, city, zip_code,
          phone_number, email)
       VALUES ($1, 'ISR', $1, $2, 'חברה לדוגמה בע"מ', 'רחוב הרצל 1', 'תל אביב', '6100000',
          '+972-3-1234567', 'office@example.com')
       ON CONFLICT (id) DO NOTHING`,
      [OWNER_ID, COMPANY_NUMBER],
    );
    await client.query(
      `UPDATE ${qualifyTable('financial_entities')} SET owner_id = $1 WHERE id = $1`,
      [OWNER_ID],
    );
    await client.query(
      `INSERT INTO ${qualifyTable('businesses_admin')} (id, owner_id, company_tax_id)
       VALUES ($1, $1, $2) ON CONFLICT DO NOTHING`,
      [OWNER_ID, WITHHOLDING_FILE_NUMBER],
    );
    await client.query(
      `INSERT INTO ${qualifyTable('business_users')} (user_id, business_id, role_id)
       VALUES ($1, $2, 'business_owner') ON CONFLICT DO NOTHING`,
      [OWNER_USER_ID, OWNER_ID],
    );

    // `business_users` references `businesses_admin`: make sure the shared admin row exists
    await client.query(
      `INSERT INTO ${qualifyTable('businesses_admin')} (id, owner_id) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [ADMIN_ID],
    );
    await client.query(
      `INSERT INTO ${qualifyTable('business_users')} (user_id, business_id, role_id)
       VALUES ($1, $2, 'business_owner') ON CONFLICT DO NOTHING`,
      [ADMIN_USER_ID, ADMIN_ID],
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
  yoga = yogaFor(OWNER_USER_ID);
  adminYoga = yogaFor(ADMIN_USER_ID);
});

beforeEach(removeReportData);

afterAll(async () => {
  if (!db) {
    return;
  }
  await removeReportData();
  await withSuperuserClient(async client => {
    await client.query(`DELETE FROM ${qualifyTable('business_users')} WHERE user_id = ANY($1)`, [
      [OWNER_USER_ID, ADMIN_USER_ID],
    ]);
    await client.query(`DELETE FROM ${qualifyTable('businesses_admin')} WHERE id = $1`, [
      OWNER_ID,
    ]);
    await client.query(
      `UPDATE ${qualifyTable('financial_entities')} SET owner_id = NULL WHERE id = $1`,
      [OWNER_ID],
    );
    await client.query(`DELETE FROM ${qualifyTable('businesses')} WHERE id = $1`, [OWNER_ID]);
    await client.query(`DELETE FROM ${qualifyTable('financial_entities')} WHERE id = $1`, [
      OWNER_ID,
    ]);
  });
});

describe('report1214', () => {
  it('lists the supported tax years', async () => {
    const data = await execute<{ report1214SupportedYears: number[] }>(
      /* GraphQL */ `
        query Report1214Years {
          report1214SupportedYears
        }
      `,
    );
    expect(data.report1214SupportedYears).toContain(2024);
  });

  it('generates the file from the books, the profile and the shareholders', async () => {
    await updateProfile(completeProfile);
    await setShareholders(shareholdersInput);

    const { report1214: report } = await execute<{ report1214: Report }>(REPORT_QUERY, {
      ownerId: OWNER_ID,
      year: YEAR,
    });

    expect(report).toMatchObject({
      id: `${OWNER_ID}:${YEAR}`,
      year: YEAR,
      owner: { id: OWNER_ID },
      profile: { id: `${OWNER_ID}:${YEAR}` },
      shareholders: [{ idNumber: '123456782' }, { idNumber: '000000018' }],
    });
    expect(report.validation.errors).toEqual([]);
    expect(report.validation.isValid).toBe(true);
    expect(report.file).not.toBeNull();
    expect(report.file!.fileName).toBe(`1214_${COMPANY_NUMBER}_${YEAR}.txt`);
    expect(report.file!.omittedZeroCodes).toEqual(expect.any(Array));

    const bytes = Buffer.from(report.file!.encodedContent, 'base64');
    expect(decode(bytes, 'windows-1255')).toContain('חברה לדוגמה בע"מ');

    const parsed = parse1214(new Uint8Array(bytes));
    expect(parsed.issues.filter(issue => issue.severity === 'error')).toEqual([]);
    expect(parsed.report.taxYear).toBe(YEAR);
    expect(parsed.report.company).toEqual({
      fileNumber: COMPANY_NUMBER,
      registeredName: 'חברה לדוגמה בע"מ',
      withholdingFileNumber: WITHHOLDING_FILE_NUMBER,
      vatFileNumber: COMPANY_NUMBER,
      occupationDescription: 'פיתוח תוכנה',
      mailingAddress: 'רחוב הרצל 1, תל אביב 6100000',
      businessAddress: 'רחוב הרצל 1, תל אביב 6100000',
      email: 'tax@example.com',
      phone: { prefix: '03', number: '1234567' },
    });
    expect(parsed.report.declarations).toMatchObject(completeProfile.declarations);
    expect(parsed.report.amounts).toMatchObject({ '018': 4, '081': 1000, '263': 1 });
    expect(parsed.report.shareholders).toEqual([
      {
        idNumber: '123456782',
        fullName: 'ישראל ישראלי',
        isControllingShareholder: true,
        dividendRightsPercent: 60,
        votingRightsPercent: 60,
      },
      {
        idNumber: '000000018',
        fullName: 'שרה כהן',
        isControllingShareholder: false,
        dividendRightsPercent: 40,
        votingRightsPercent: 40,
      },
    ]);
  });

  it('lists the amounts: overrides, and code 165 computed from the R&D investments', async () => {
    await updateProfile({
      ...completeProfile,
      rdInvestments: [
        { companyName: 'מחקר בע"מ', investmentAmount: 1000 },
        { companyName: 'פיתוח בע"מ', investmentAmount: 2500 },
      ],
    });
    await setShareholders(shareholdersInput);

    const { report1214: report } = await execute<{ report1214: AmountsReport }>(AMOUNTS_QUERY, {
      ownerId: OWNER_ID,
      year: YEAR,
    });
    const override = (code: string, amount: number): AmountRow => ({
      code,
      amount,
      source: 'OVERRIDE',
      computedAmount: null,
      label: null,
    });
    expect(report.amounts).toEqual([
      override('018', 4),
      override('072', 0),
      override('081', 1000),
      override('094', 0),
      {
        code: '165',
        amount: 3500,
        source: 'COMPUTED',
        computedAmount: 3500,
        label: 'סך השקעות בחברות מו"פ',
      },
      override('263', 1),
    ]);
    expect(report.validation.errors).toEqual([]);
    // no code needs the books yet, so nothing is loaded or skipped
    expect(
      report.validation.warnings.filter(
        ({ ruleId }) => ruleId.startsWith('accounter.amounts.') || ruleId.startsWith('main.rd.'),
      ),
    ).toEqual([]);

    const parsed = parse1214(new Uint8Array(Buffer.from(report.file!.encodedContent, 'base64')));
    expect(parsed.report.amounts).toMatchObject({ '165': 3500 });
    expect(parsed.report.rdInvestments).toHaveLength(2);
  });

  it('lets an override replace the computed amount, and still shows the computed one', async () => {
    await updateProfile({
      ...completeProfile,
      rdInvestments: [{ companyName: 'מחקר בע"מ', investmentAmount: 1000 }],
      amountOverrides: [...completeProfile.amountOverrides, { code: '165', amount: 1200 }],
    });
    await setShareholders(shareholdersInput);

    const { report1214: report } = await execute<{ report1214: AmountsReport }>(AMOUNTS_QUERY, {
      ownerId: OWNER_ID,
      year: YEAR,
    });
    expect(report.amounts.find(row => row.code === '165')).toEqual({
      code: '165',
      amount: 1200,
      source: 'OVERRIDE',
      computedAmount: 1000,
      label: 'סך השקעות בחברות מו"פ',
    });
    // the generator flags the override that disagrees with the investments
    expect(report.validation.warnings.map(issue => issue.ruleId)).toContain('main.rd.total');
  });

  it('withholds the file while validation has errors', async () => {
    await updateProfile(completeProfile);
    await setShareholders([
      shareholdersInput[0],
      { ...shareholdersInput[1], dividendRightsPercent: 30 },
    ]);

    const json = await executeRaw<{ report1214: Report }>(REPORT_QUERY, {
      ownerId: OWNER_ID,
      year: YEAR,
    });
    const report = json.data!.report1214;
    expect(report.validation.isValid).toBe(false);
    expect(report.validation.errors).toContainEqual(
      expect.objectContaining({ ruleId: 'shareholders.dividendRights.total', severity: 'ERROR' }),
    );
    expect(report.file).toBeNull();
    expect(json.errors).toHaveLength(1);
    expect(json.errors![0].path).toEqual(['report1214', 'file']);
    expect(json.errors![0].extensions?.code).toBe('REPORT_1214_VALIDATION_FAILED');
  });

  it('reports unanswered declarations as mapping errors', async () => {
    await updateProfile({ ...completeProfile, declarations: { hasTaxPlanningAction: true } });
    await setShareholders(shareholdersInput);

    const data = await execute<{ report1214: Pick<Report, 'validation'> }>(VALIDATION_QUERY, {
      ownerId: OWNER_ID,
      year: YEAR,
    });
    const missing = data.report1214.validation.errors.filter(
      issue => issue.ruleId === 'accounter.declarations.missing',
    );
    expect(missing.map(issue => issue.path)).toContain('declarations.tookReportablePosition');
    expect(missing).toHaveLength(6);
  });

  it('reports a year the generator does not support as a mapping error', async () => {
    const data = await execute<{ report1214: Pick<Report, 'validation'> }>(VALIDATION_QUERY, {
      ownerId: OWNER_ID,
      year: 2023,
    });
    expect(data.report1214.validation).toEqual({
      isValid: false,
      errors: [{ ruleId: 'accounter.taxYear.unsupported', path: 'taxYear', severity: 'ERROR' }],
    });
  });

  it('defaults to the active business', async () => {
    const data = await execute<{ report1214: Pick<Report, 'id'> }>(
      /* GraphQL */ `
        query Report1214Default($year: Int!) {
          report1214(year: $year) {
            id
          }
        }
      `,
      { year: YEAR },
    );
    expect(data.report1214.id).toBe(`${OWNER_ID}:${YEAR}`);
  });

  it("forbids another tenant's user from reading the owner's report", async () => {
    const json = await executeRaw(VALIDATION_QUERY, { ownerId: OWNER_ID, year: YEAR }, adminYoga);
    expect(json.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('rejects a year out of range', async () => {
    const json = await executeRaw(VALIDATION_QUERY, { ownerId: OWNER_ID, year: 40_000 });
    expect(json.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });
});
