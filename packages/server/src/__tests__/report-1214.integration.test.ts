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
 * The report owner and the second tenant are companies of their own (each with its own user), so
 * the suite can use a real tax year (2024) and never touches the shared admin business.
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
/** Another tenant, whose user must not see the owner's report */
const OTHER_OWNER_ID = makeUUID('business', 'report-1214-other-owner');
const OTHER_USER_ID = makeUUID('user', 'report-1214-other-user');

const YEAR = 2024;
/** A valid company number and its withholding file number (9 + first 7 digits + check digit) */
const COMPANY_NUMBER = '514000009';
const WITHHOLDING_FILE_NUMBER = '951400001';

/** The owner's identity in the books */
const OWNER_BUSINESS = {
  vat_number: COMPANY_NUMBER,
  hebrew_name: 'חברה לדוגמה בע"מ',
  address_hebrew: 'רחוב הרצל 1',
  city: 'תל אביב',
  zip_code: '6100000',
  phone_number: '+972-3-1234567',
  email: 'office@example.com',
};
const BOOKS_ADDRESS = 'רחוב הרצל 1, תל אביב 6100000';

const ISSUE_FIELDS = /* GraphQL */ `
  ruleId
  path
  severity
  code
`;

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
          ${ISSUE_FIELDS}
        }
        warnings {
          ${ISSUE_FIELDS}
        }
      }
      file {
        fileName
        encodedContent
        warnings {
          ${ISSUE_FIELDS}
        }
        omittedZeroCodes {
          record
          recordIndex
          code
        }
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

type Issue = {
  ruleId: string;
  path: string | null;
  severity: 'ERROR' | 'WARNING';
  code?: string | null;
};
type Report = {
  id: string;
  year: number;
  owner: { id: string };
  profile: { id: string };
  shareholders: Array<{ idNumber: string }>;
  validation: { isValid: boolean; errors: Issue[]; warnings: Issue[] };
  file: {
    fileName: string;
    encodedContent: string;
    warnings: Issue[];
    omittedZeroCodes: Array<{ record: string; recordIndex: number; code: string }>;
  } | null;
};

type GraphQLResponse<T> = {
  data?: T | null;
  errors?: Array<{ message: string; path?: string[]; extensions?: { code?: string } }>;
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

const updateProfile = (input: Record<string, unknown>) =>
  execute(UPDATE_PROFILE_MUTATION, { ownerId: OWNER_ID, year: YEAR, input });

const setShareholders = (shareholders: Array<Record<string, unknown>>) =>
  execute(SET_SHAREHOLDERS_MUTATION, { ownerId: OWNER_ID, year: YEAR, shareholders });

/** The full report, with the errors of the call (the `file` error, when withheld) */
async function getReport(year = YEAR) {
  const json = await executeRaw<{ report1214: Report }>(REPORT_QUERY, { ownerId: OWNER_ID, year });
  return { report: json.data!.report1214, errors: json.errors ?? [] };
}

/** The report's file, decoded and parsed */
function parseFile(file: NonNullable<Report['file']>) {
  const bytes = Buffer.from(file.encodedContent, 'base64');
  return { text: decode(bytes, 'windows-1255'), parsed: parse1214(new Uint8Array(bytes)) };
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

/** Sets the owner's identity columns in the books (`businesses`) */
const setOwnerBusiness = (columns: Partial<Record<keyof typeof OWNER_BUSINESS, string | null>>) =>
  withSuperuserClient(async client => {
    for (const [column, value] of Object.entries(columns)) {
      await client.query(`UPDATE ${qualifyTable('businesses')} SET ${column} = $2 WHERE id = $1`, [
        OWNER_ID,
        value,
      ]);
    }
  });

async function removeReportData() {
  await withSuperuserClient(async client => {
    await client.query(`DELETE FROM ${qualifyTable('report_1214_profiles')} WHERE owner_id = $1`, [
      OWNER_ID,
    ]);
    await client.query(`DELETE FROM ${qualifyTable('shareholders')} WHERE owner_id = $1`, [
      OWNER_ID,
    ]);
  });
  await setOwnerBusiness(OWNER_BUSINESS);
}

/** Creates a company owner of its own, with a user who owns it */
async function createOwner(
  client: PoolClient,
  ownerId: string,
  userId: string,
  name: string,
  companyTaxId: string | null,
) {
  await client.query(
    `INSERT INTO ${qualifyTable('financial_entities')} (id, name, type, owner_id)
     VALUES ($1, $2, 'business', NULL) ON CONFLICT (id) DO NOTHING`,
    [ownerId, name],
  );
  await client.query(
    `INSERT INTO ${qualifyTable('businesses')} (id, country, owner_id) VALUES ($1, 'ISR', $1)
     ON CONFLICT (id) DO NOTHING`,
    [ownerId],
  );
  await client.query(
    `UPDATE ${qualifyTable('financial_entities')} SET owner_id = $1 WHERE id = $1`,
    [ownerId],
  );
  await client.query(
    `INSERT INTO ${qualifyTable('businesses_admin')} (id, owner_id, company_tax_id)
     VALUES ($1, $1, $2) ON CONFLICT DO NOTHING`,
    [ownerId, companyTaxId],
  );
  await client.query(
    `INSERT INTO ${qualifyTable('business_users')} (user_id, business_id, role_id)
     VALUES ($1, $2, 'business_owner') ON CONFLICT DO NOTHING`,
    [userId, ownerId],
  );
}

async function removeOwner(client: PoolClient, ownerId: string, userId: string) {
  await client.query(`DELETE FROM ${qualifyTable('business_users')} WHERE user_id = $1`, [userId]);
  await client.query(`DELETE FROM ${qualifyTable('businesses_admin')} WHERE id = $1`, [ownerId]);
  await client.query(
    `UPDATE ${qualifyTable('financial_entities')} SET owner_id = NULL WHERE id = $1`,
    [ownerId],
  );
  await client.query(`DELETE FROM ${qualifyTable('businesses')} WHERE id = $1`, [ownerId]);
  await client.query(`DELETE FROM ${qualifyTable('financial_entities')} WHERE id = $1`, [ownerId]);
}

const completeDeclarations = {
  hasTaxPlanningAction: false,
  hadRelatedPartyTransactions: true,
  controlsBodyOfPersons: false,
  holdsRightsInBodyOfPersons: false,
  appliesAccountingStandards: false,
  directorsReceivedOpinion: false,
  tookReportablePosition: false,
};

const requiredAmounts = [
  { code: '018', amount: 4 },
  { code: '072', amount: 0 },
  { code: '081', amount: 1000 },
  { code: '094', amount: 0 },
  { code: '263', amount: 1 },
];

const completeProfile = {
  company: {
    occupationDescription: 'פיתוח תוכנה',
    email: 'tax@example.com',
  },
  declarations: completeDeclarations,
  // 070 (donations) is not zero-allowed: its 0 is left out of the file
  amountOverrides: [...requiredAmounts, { code: '070', amount: 0 }],
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
    await createOwner(client, OWNER_ID, OWNER_USER_ID, 'Report 1214 Ltd', WITHHOLDING_FILE_NUMBER);
    await createOwner(client, OTHER_OWNER_ID, OTHER_USER_ID, 'Report 1214 other owner', null);
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
  otherYoga = yogaFor(OTHER_USER_ID);
});

beforeEach(removeReportData);

afterAll(async () => {
  if (!db) {
    return;
  }
  await withSuperuserClient(async client => {
    await client.query(`DELETE FROM ${qualifyTable('report_1214_profiles')} WHERE owner_id = $1`, [
      OWNER_ID,
    ]);
    await client.query(`DELETE FROM ${qualifyTable('shareholders')} WHERE owner_id = $1`, [
      OWNER_ID,
    ]);
    await removeOwner(client, OWNER_ID, OWNER_USER_ID);
    await removeOwner(client, OTHER_OWNER_ID, OTHER_USER_ID);
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

    const { report, errors } = await getReport();
    expect(errors).toEqual([]);
    expect(report).toMatchObject({
      id: `${OWNER_ID}:${YEAR}`,
      year: YEAR,
      owner: { id: OWNER_ID },
      profile: { id: `${OWNER_ID}:${YEAR}` },
      shareholders: [{ idNumber: '123456782' }, { idNumber: '000000018' }],
    });
    expect(report.validation).toEqual({ isValid: true, errors: [], warnings: [] });
    expect(report.file).not.toBeNull();
    expect(report.file!.fileName).toBe(`1214_${COMPANY_NUMBER}_${YEAR}.txt`);
    expect(report.file!.warnings).toEqual([]);
    expect(report.file!.omittedZeroCodes).toEqual([
      { record: '1000', recordIndex: 0, code: '070' },
    ]);

    const { text, parsed } = parseFile(report.file!);
    expect(text).toContain('חברה לדוגמה בע"מ');
    expect(parsed.issues.filter(issue => issue.severity === 'error')).toEqual([]);
    expect(parsed.report.taxYear).toBe(YEAR);
    expect(parsed.report.company).toEqual({
      fileNumber: COMPANY_NUMBER,
      registeredName: 'חברה לדוגמה בע"מ',
      withholdingFileNumber: WITHHOLDING_FILE_NUMBER,
      vatFileNumber: COMPANY_NUMBER,
      occupationDescription: 'פיתוח תוכנה',
      mailingAddress: BOOKS_ADDRESS,
      businessAddress: BOOKS_ADDRESS,
      email: 'tax@example.com',
      phone: { prefix: '03', number: '1234567' },
    });
    expect(parsed.report.declarations).toEqual(completeDeclarations);
    // 072 and 094 allow a 0 and keep it; the 0 of 070 is left out
    expect(parsed.report.amounts).toEqual({
      '018': 4,
      '072': 0,
      '081': 1000,
      '094': 0,
      '263': 1,
    });
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

  it('reports every stored profile block in the file', async () => {
    await updateProfile({
      company: {
        phone: { prefix: '054', number: '7654321' },
        fax: { prefix: '03', number: '7654322' },
      },
      declarations: {
        ...completeDeclarations,
        controlsBodyOfPersons: true,
        holdsRightsInBodyOfPersons: true,
      },
      preparer: {
        officeName: 'משרד רואי חשבון',
        contactName: 'דנה לוי',
        name: 'דנה לוי',
        profession: 'רואת חשבון',
        licensedDealerNumber: '123456782',
        address: 'רחוב יפו 10, ירושלים',
        phone: { prefix: '02', number: '6543210' },
      },
      attachments: { donationReceiptsCount: 2, withholdingCertificatesCount: 3 },
      bankAccount: { bank: '12', branch: '345', account: '678' },
      otherTaxableIncome: { source: 'ריבית מבנק', amount: 1500, ratePercent: 23 },
      capitalGainsSummary: {
        totalAppendicesCount: 1,
        untransmittedCount: 1,
        reasons: { other: true, otherText: 'סיבה אחרת' },
      },
      qualifyingCompany: {
        purchased: true,
        israeliPurchaseAmount: 50_000,
        amortizationClaimed: true,
        amortizationAmount: 0,
      },
      relatedCompanies: [
        {
          companyName: 'חברת בת בע"מ',
          companyFileNumber: '516123452',
          relationType: 'SUBSIDIARY',
          assessingOfficeCode: 34,
        },
      ],
      rdInvestments: [
        { companyName: 'מחקר ופיתוח בע"מ', companyFileNumber: '510000003', investmentAmount: 7000 },
        { companyName: 'חדשנות בע"מ', investmentAmount: 3000 },
      ],
      amountOverrides: [
        ...requiredAmounts,
        { code: '010', amount: 500 }, // withholding certificates
        { code: '070', amount: 200 }, // donation receipts
        { code: '165', amount: 10_000 }, // total R&D investments
      ],
    });
    await setShareholders([{ ...shareholdersInput[0], dividendRightsPercent: 100 }]);

    const { report, errors } = await getReport();
    expect(errors).toEqual([]);
    expect(report.validation).toEqual({ isValid: true, errors: [], warnings: [] });

    const { parsed } = parseFile(report.file!);
    expect(parsed.issues.filter(issue => issue.severity === 'error')).toEqual([]);
    expect(parsed.report).toMatchObject({
      company: {
        phone: { prefix: '054', number: '7654321' },
        fax: { prefix: '03', number: '7654322' },
      },
      declarations: {
        ...completeDeclarations,
        controlsBodyOfPersons: true,
        holdsRightsInBodyOfPersons: true,
      },
      amounts: { '010': 500, '070': 200, '165': 10_000 },
    });
    expect(parsed.report.preparer).toEqual({
      officeName: 'משרד רואי חשבון',
      contactName: 'דנה לוי',
      name: 'דנה לוי',
      profession: 'רואת חשבון',
      licensedDealerNumber: '123456782',
      address: 'רחוב יפו 10, ירושלים',
      phone: { prefix: '02', number: '6543210' },
    });
    expect(parsed.report.attachments).toEqual({
      donationReceiptsCount: 2,
      withholdingCertificatesCount: 3,
    });
    // the account as code 277 holds it, zero-padded to 9 digits
    expect(parsed.report.bankAccount).toEqual({ bank: '12', branch: '345', account: '000000678' });
    expect(parsed.report.otherTaxableIncome).toEqual({
      source: 'ריבית מבנק',
      amount: 1500,
      ratePercent: 23,
    });
    expect(parsed.report.capitalGainsSummary).toEqual({
      totalAppendicesCount: 1,
      untransmittedCount: 1,
      reasons: { other: true, otherText: 'סיבה אחרת' },
    });
    expect(parsed.report.qualifyingCompany).toEqual({
      purchased: true,
      israeliPurchaseAmount: 50_000,
      amortizationClaimed: true,
      amortizationAmount: 0,
    });
    expect(parsed.report.relatedCompanies).toEqual([
      {
        companyName: 'חברת בת בע"מ',
        companyFileNumber: '516123452',
        relationType: 'subsidiary',
        assessingOfficeCode: 34,
      },
    ]);
    expect(parsed.report.rdInvestments).toEqual([
      { companyName: 'מחקר ופיתוח בע"מ', companyFileNumber: '510000003', investmentAmount: 7000 },
      { companyName: 'חדשנות בע"מ', investmentAmount: 3000 },
    ]);
  });

  it('withholds the file while validation has errors', async () => {
    await updateProfile(completeProfile);
    await setShareholders([
      shareholdersInput[0],
      { ...shareholdersInput[1], dividendRightsPercent: 30 },
    ]);

    const { report, errors } = await getReport();
    expect(report.validation.isValid).toBe(false);
    expect(report.validation.errors).toContainEqual(
      expect.objectContaining({ ruleId: 'shareholders.dividendRights.total', severity: 'ERROR' }),
    );
    expect(report.file).toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toEqual(['report1214', 'file']);
    expect(errors[0].extensions?.code).toBe('REPORT_1214_VALIDATION_FAILED');
  });

  it('withholds the file on a mapping error alone', async () => {
    // unanswered declarations: the generator input (filled with "no") is otherwise valid
    await updateProfile({ ...completeProfile, declarations: { hasTaxPlanningAction: true } });
    await setShareholders(shareholdersInput);

    const { report, errors } = await getReport();
    expect(report.validation.isValid).toBe(false);
    expect(report.validation.errors.map(issue => [issue.ruleId, issue.path])).toEqual([
      ['accounter.declarations.missing', 'declarations.hadRelatedPartyTransactions'],
      ['accounter.declarations.missing', 'declarations.controlsBodyOfPersons'],
      ['accounter.declarations.missing', 'declarations.holdsRightsInBodyOfPersons'],
      ['accounter.declarations.missing', 'declarations.appliesAccountingStandards'],
      ['accounter.declarations.missing', 'declarations.directorsReceivedOpinion'],
      ['accounter.declarations.missing', 'declarations.tookReportablePosition'],
    ]);
    expect(report.file).toBeNull();
    expect(errors.map(error => error.extensions?.code)).toEqual(['REPORT_1214_VALIDATION_FAILED']);
  });

  it('files the report with a mapping warning, carried on the file', async () => {
    await updateProfile(completeProfile);
    await setShareholders(shareholdersInput);
    // A stored override of a derived code (008 = applies accounting standards): the API refuses
    // to write one, but a profile saved against another year's layout can hold it
    await withSuperuserClient(client =>
      client.query(
        `UPDATE ${qualifyTable('report_1214_profiles')}
         SET amount_overrides = amount_overrides || '{"008": 1}'::jsonb
         WHERE owner_id = $1 AND year = $2`,
        [OWNER_ID, YEAR],
      ),
    );

    const { report, errors } = await getReport();
    expect(errors).toEqual([]);
    const dropped = {
      ruleId: 'accounter.amounts.derivedOverrideDropped',
      path: 'amounts["008"]',
      severity: 'WARNING',
      code: '008',
    };
    expect(report.validation).toEqual({ isValid: true, errors: [], warnings: [dropped] });
    expect(report.file!.warnings).toEqual([dropped]);
    expect(parseFile(report.file!).parsed.report.amounts).not.toHaveProperty('008');
  });

  it('reports identity the books lack, once per item', async () => {
    await updateProfile(completeProfile);
    await setShareholders(shareholdersInput);

    await setOwnerBusiness({ phone_number: '+1 212 555 1234' });
    let { report } = await getReport();
    expect(report.validation.errors).toEqual([
      {
        ruleId: 'accounter.company.phone.unparsable',
        path: 'company.phone',
        severity: 'ERROR',
        code: null,
      },
    ]);
    expect(report.file).toBeNull();

    await setOwnerBusiness({ phone_number: null, vat_number: null });
    ({ report } = await getReport());
    expect(report.validation.errors.map(issue => [issue.ruleId, issue.path])).toEqual([
      ['accounter.company.fileNumber.missing', 'company.fileNumber'],
      ['accounter.company.phone.missing', 'company.phone'],
    ]);
    expect(report.file).toBeNull();

    // a profile phone stands in for the missing one
    await updateProfile({ company: { phone: { prefix: '052', number: '1111111' } } });
    ({ report } = await getReport());
    expect(report.validation.errors.map(issue => issue.ruleId)).toEqual([
      'accounter.company.fileNumber.missing',
    ]);
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
    const json = await executeRaw(VALIDATION_QUERY, { ownerId: OWNER_ID, year: YEAR }, otherYoga);
    expect(json.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('rejects a year out of range', async () => {
    const json = await executeRaw(VALIDATION_QUERY, { ownerId: OWNER_ID, year: 40_000 });
    expect(json.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });
});
