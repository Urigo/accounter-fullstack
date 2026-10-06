import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { executeRegisteredTool } from '../execute.js';
import { MAX_TOOL_RESULT_BYTES } from '../output.js';
import {
  VAT_REPORT_MAX_PAGE_SIZE,
  VAT_REPORT_MAX_RESULT_BYTES,
  VAT_REPORT_SECTIONS,
  VAT_REPORT_TOOL_NAME,
  vatReportTool,
} from '../reports/vat-report.js';
import { missingInfoCharge, vatRecord, vatReportData } from './vat-report-fixtures.js';

const B1 = 'aa000000-0000-4000-8000-000000000001';
const B2 = 'aa000000-0000-4000-8000-000000000002';

function authContext(memberBusinessIds: string[] = [B1], roleId = 'accountant'): McpAuthContext {
  const principal: AuthPrincipal = {
    subject: 'user-1',
    issuer: 'https://tenant.auth0.com/',
    audience: 'aud',
    scopes: ['openid'],
    email: null,
    expiresAt: undefined,
    claims: { sub: 'user-1' },
  };
  return buildAuthContext(
    principal,
    memberBusinessIds.map(memberBusinessId => ({ memberBusinessId, roleId })),
  );
}

interface SentBody {
  query: string;
  variables: { filters: Record<string, unknown> };
}

function clientReturning(data: unknown, sent: SentBody[] = []) {
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(init.body as string) as SentBody);
    return { ok: true, status: 200, json: async () => ({ data }) } as unknown as Response;
  });
  const client = new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    longRunningTimeoutMs: 300_000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { client, fetchImpl, sent };
}

const run = (client: UpstreamGraphQLClient, rawArgs: unknown, auth = authContext()) =>
  executeRegisteredTool({
    tool: vatReportTool,
    rawArgs,
    auth,
    correlationId: 'c',
    client,
    authorization: 'Bearer t',
  });

type Structured = Record<string, unknown> & {
  returnedCount: number;
  totalCount: number;
  truncated: boolean;
  offset: number;
  section: string;
  month: string;
  memberBusinessId: string;
  counts: Record<string, number>;
  summary: Record<string, unknown>;
  continuation?: { reason: string; returnedCount: number; totalCount: number };
};

const structuredOf = (result: { structuredContent?: unknown }) =>
  result.structuredContent as Structured;

const args = (overrides: Record<string, unknown> = {}) => ({
  memberBusinessId: B1,
  month: '2026-03',
  section: 'income',
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('vatReportTool — upstream request', () => {
  it('is registered under the expected name', () => {
    expect(vatReportTool.name).toBe(VAT_REPORT_TOOL_NAME);
    expect(VAT_REPORT_TOOL_NAME).toBe('accounter_vat_report');
  });

  it('forwards month as monthDate YYYY-MM-01 and the business as financialEntityId, never chargesType', async () => {
    const { client, sent } = clientReturning(vatReportData());
    const result = await run(client, args());

    expect(result.isError).toBeUndefined();
    expect(sent).toHaveLength(1);
    // Exact keys: `chargesType` must be absent, not merely null (#4604).
    expect(sent[0]!.variables).toEqual({
      filters: { monthDate: '2026-03-01', financialEntityId: B1 },
    });
    expect(Object.keys(sent[0]!.variables.filters)).not.toContain('chargesType');
    expect(sent[0]!.query).toMatch(/\bsummary\s*\{/);
    expect(sent[0]!.query).not.toMatch(/chargesType/);
  });

  it('runs upstream on the long-running budget', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const { client } = clientReturning(vatReportData());
    await run(client, args());

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 300_000);
    expect(setTimeoutSpy).not.toHaveBeenCalledWith(expect.any(Function), 1000);
  });

  it('passes { longRunning: true } to the upstream client', async () => {
    const { client } = clientReturning(vatReportData());
    const querySpy = vi.spyOn(client, 'query');
    await run(client, args());

    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(querySpy.mock.calls[0]![2]).toEqual({ longRunning: true });
  });
});

describe('vatReportTool — input validation and scope', () => {
  it.each(['2026-13', '2026-00', '2026-9', '2026-09-01', '26-09', ''])(
    'rejects month %j without calling upstream',
    async month => {
      const { client, fetchImpl } = clientReturning(vatReportData());
      const result = await run(client, args({ month }));

      expect(result.isError).toBe(true);
      expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['an unknown section', { section: 'differentMonthDoc' }],
    ['a missing section', { section: undefined }],
    ['a negative offset', { offset: -1 }],
    ['a zero limit', { limit: 0 }],
    ['a limit above the page cap', { limit: VAT_REPORT_MAX_PAGE_SIZE + 1 }],
    ['a chargesType input', { chargesType: 'INCOME' }],
  ])('rejects %s without calling upstream', async (_label, overrides) => {
    const { client, fetchImpl } = clientReturning(vatReportData());
    const result = await run(client, args(overrides));

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('denies a business outside the caller memberships without calling upstream', async () => {
    const { client, fetchImpl } = clientReturning(vatReportData());
    const result = await run(client, args({ memberBusinessId: B2 }), authContext([B1]));

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('denies a caller without the required role', async () => {
    const { client, fetchImpl } = clientReturning(vatReportData());
    const result = await run(client, args(), authContext([B1], 'viewer'));

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('vatReportTool — sections, counts and summary', () => {
  const data = vatReportData({
    income: [vatRecord('in-1'), vatRecord('in-2')],
    expenses: [vatRecord('ex-1', { recordType: 'T' })],
    missingInfo: [missingInfoCharge('mi-1'), missingInfoCharge('mi-2'), missingInfoCharge('mi-3')],
  });

  const EXPECTED_SUMMARY = {
    taxableSalesAmount: { value: 1000, formatted: '₪1,000.00', currency: 'ILS' },
    taxableSalesVat: { value: 170, formatted: '₪170.00', currency: 'ILS' },
    salesRecordCount: 1,
    zeroValOrExemptSalesAmount: { value: 0, formatted: '₪0.00', currency: 'ILS' },
    otherInputsVat: { value: 51, formatted: '₪51.00', currency: 'ILS' },
    equipmentInputsVat: { value: 0, formatted: '₪0.00', currency: 'ILS' },
    inputsCount: 1,
    totalVat: { value: 119, formatted: '₪119.00', currency: 'ILS' },
  };

  it.each([
    ['income', 2],
    ['expenses', 1],
    ['missingInfo', 3],
  ] as const)('returns %s rows under their own key', async (section, expected) => {
    const { client } = clientReturning(data);
    const structured = structuredOf(await run(client, args({ section })));

    expect(structured.section).toBe(section);
    expect(structured[section]).toHaveLength(expected);
    for (const other of VAT_REPORT_SECTIONS.filter(name => name !== section)) {
      expect(structured).not.toHaveProperty(other);
    }
    expect(structured.returnedCount).toBe(expected);
    expect(structured.totalCount).toBe(expected);
    expect(structured.truncated).toBe(false);
  });

  it('reports counts for all three sections and the same normalized summary on every call', async () => {
    const results = await Promise.all(
      VAT_REPORT_SECTIONS.map(async section => {
        const { client } = clientReturning(data);
        return structuredOf(await run(client, args({ section })));
      }),
    );

    for (const structured of results) {
      expect(structured.counts).toEqual({ income: 2, expenses: 1, missingInfo: 3 });
      expect(structured.summary).toEqual(EXPECTED_SUMMARY);
      expect(structured.memberBusinessId).toBe(B1);
      expect(structured.month).toBe('2026-03');
      expect(structured.offset).toBe(0);
      expect(structured.scope).toEqual({ memberBusinessIds: [B1] });
    }
  });

  it('names the month, the VAT to pay and the section in the summary line', async () => {
    const { client } = clientReturning(data);
    const result = await run(client, args({ section: 'missingInfo' }));

    expect(result.content[0]!.text).toBe(
      'VAT report for 2026-03: total VAT ₪119.00 to pay. Showing missingInfo rows 1–3 of 3.',
    );
  });

  it('words a negative totalVat as a refund', async () => {
    const summary = {
      ...vatReportData().vatReport.summary,
      totalVat: { raw: -42, formatted: '-₪42.00', currency: 'ILS' },
    };
    const { client } = clientReturning(vatReportData({ summary }));
    const result = await run(client, args());

    expect(result.content[0]!.text).toMatch(/total VAT -₪42\.00 refund/);
  });

  it('tolerates absent buckets and summary from upstream', async () => {
    const { client } = clientReturning({ vatReport: { summary: null } });
    const result = await run(client, args({ section: 'expenses' }));

    expect(result.isError).toBeUndefined();
    const structured = structuredOf(result);
    expect(structured.expenses).toEqual([]);
    expect(structured.counts).toEqual({ income: 0, expenses: 0, missingInfo: 0 });
    expect(structured.summary).toBeNull();
  });
});

describe('vatReportTool — row shapes', () => {
  it('forwards every VatReportRecord field on an income row, amounts normalized', async () => {
    const { client } = clientReturning(vatReportData());
    const structured = structuredOf(await run(client, args({ section: 'income' })));

    expect(structured.income).toEqual([
      {
        chargeId: 'charge-in-1',
        documentId: 'doc-in-1',
        ownerId: B1,
        chargeAccountantStatus: 'APPROVED',
        business: { id: 'biz-in-1', name: 'Counterparty in-1' },
        vatNumber: '514000000',
        image: 'https://images.example.com/in-1.png',
        documentSerial: 'INV-in-1',
        documentDate: '2026-03-04',
        allocationNumber: '123456789',
        chargeDate: '2026-03-05',
        amount: { value: 1170, formatted: '₪1,170.00', currency: 'ILS' },
        localAmount: { value: 1170, formatted: '₪1,170.00', currency: 'ILS' },
        localVat: { value: 170, formatted: '₪170.00', currency: 'ILS' },
        foreignVat: null,
        foreignVatAfterDeduction: null,
        localVatAfterDeduction: { value: 170, formatted: '₪170.00', currency: 'ILS' },
        roundedLocalVatAfterDeduction: { value: 170, formatted: '₪170', currency: 'ILS' },
        taxReducedLocalAmount: { value: 1000, formatted: '₪1,000', currency: 'ILS' },
        taxReducedForeignAmount: null,
        recordType: 'S1',
        isProperty: false,
      },
    ]);
  });

  it('preserves nulls on an expense row (upstream drops zero amounts)', async () => {
    const sparse = vatRecord('ex-9', {
      chargeAccountantStatus: null,
      documentId: null,
      business: null,
      vatNumber: null,
      image: null,
      documentSerial: null,
      documentDate: null,
      allocationNumber: null,
      chargeDate: null,
      localAmount: null,
      localVat: null,
      localVatAfterDeduction: null,
      roundedLocalVatAfterDeduction: null,
      taxReducedLocalAmount: null,
      foreignVat: { raw: 17, formatted: '$17.00', currency: 'USD' },
      foreignVatAfterDeduction: { raw: 11.33, formatted: '$11.33', currency: 'USD' },
      recordType: 'T',
      isProperty: true,
    });
    const { client } = clientReturning(vatReportData({ expenses: [sparse] }));
    const [row] = structuredOf(await run(client, args({ section: 'expenses' }))).expenses as Array<
      Record<string, unknown>
    >;

    expect(row).toMatchObject({
      chargeAccountantStatus: null,
      documentId: null,
      business: null,
      vatNumber: null,
      image: null,
      documentSerial: null,
      documentDate: null,
      allocationNumber: null,
      chargeDate: null,
      localAmount: null,
      localVat: null,
      localVatAfterDeduction: null,
      roundedLocalVatAfterDeduction: null,
      taxReducedLocalAmount: null,
      taxReducedForeignAmount: null,
      foreignVat: { value: 17, formatted: '$17.00', currency: 'USD' },
      foreignVatAfterDeduction: { value: 11.33, formatted: '$11.33', currency: 'USD' },
      recordType: 'T',
      isProperty: true,
    });
  });

  it('builds a compact missing-info row from the charge', async () => {
    const { client } = clientReturning(
      vatReportData({
        missingInfo: [
          missingInfoCharge('mi-1', { __typename: 'BusinessTripCharge' }),
          missingInfoCharge('mi-2', {
            __typename: 'SomeFutureCharge',
            userDescription: null,
            minEventDate: null,
            minDocumentsDate: '2026-03-02T00:00:00.000Z',
            totalAmount: null,
            counterparty: null,
            validationData: null,
          }),
        ],
      }),
    );
    const structured = structuredOf(await run(client, args({ section: 'missingInfo' })));

    expect(structured.missingInfo).toEqual([
      {
        chargeId: 'mi-1',
        ownerId: B1,
        chargeType: 'BUSINESS_TRIP',
        description: 'Charge mi-1',
        minEventDate: '2026-03-10T00:00:00.000Z',
        minDocumentsDate: null,
        amount: { value: -250, formatted: '₪-250.00', currency: 'ILS' },
        counterparty: { id: 'biz-mi-1', name: 'Vendor mi-1' },
        accountantStatus: 'UNAPPROVED',
        // Forwarded verbatim, in upstream order.
        missing: ['DOCUMENTS', 'TAGS'],
      },
      {
        chargeId: 'mi-2',
        ownerId: B1,
        chargeType: null,
        description: null,
        minEventDate: null,
        minDocumentsDate: '2026-03-02T00:00:00.000Z',
        amount: null,
        counterparty: null,
        accountantStatus: 'UNAPPROVED',
        missing: [],
      },
    ]);
  });
});

describe('vatReportTool — offset paging', () => {
  const income = Array.from({ length: 7 }, (_, i) => vatRecord(`in-${i}`));
  const data = vatReportData({ income });
  const chargeIds = (structured: Structured) =>
    (structured.income as Array<{ chargeId: string }>).map(row => row.chargeId);

  it('slices [offset, offset + limit) and points at the next offset', async () => {
    const { client } = clientReturning(data);
    const result = await run(client, args({ offset: 2, limit: 3 }));
    const structured = structuredOf(result);

    expect(chargeIds(structured)).toEqual(['charge-in-2', 'charge-in-3', 'charge-in-4']);
    expect(structured.offset).toBe(2);
    expect(structured.returnedCount).toBe(3);
    // Rows from the offset to the end of the section: 7 - 2.
    expect(structured.totalCount).toBe(5);
    expect(structured.truncated).toBe(true);
    expect(structured.continuation?.reason).toBe('result_cap');
    expect(structured.counts.income).toBe(7);
    expect(result.content[0]!.text).toMatch(/income rows 3–5 of 7; call again with offset 5/);
  });

  it('marks the last page as complete', async () => {
    const { client } = clientReturning(data);
    const result = await run(client, args({ offset: 5, limit: 3 }));
    const structured = structuredOf(result);

    expect(chargeIds(structured)).toEqual(['charge-in-5', 'charge-in-6']);
    expect(structured.totalCount).toBe(2);
    expect(structured.truncated).toBe(false);
    expect(structured).not.toHaveProperty('continuation');
    expect(result.content[0]!.text).not.toMatch(/call again/);
  });

  it('returns an empty page, not an error, for an offset past the end', async () => {
    const { client } = clientReturning(data);
    const result = await run(client, args({ offset: 50 }));
    const structured = structuredOf(result);

    expect(result.isError).toBeUndefined();
    expect(structured.income).toEqual([]);
    expect(structured.returnedCount).toBe(0);
    expect(structured.totalCount).toBe(0);
    expect(structured.truncated).toBe(false);
    expect(structured.counts.income).toBe(7);
    expect(result.content[0]!.text).toMatch(/no income rows from offset 50 \(7 in total\)/);
  });

  it('defaults to offset 0 and a full page', async () => {
    const { client } = clientReturning(data);
    const structured = structuredOf(await run(client, args()));

    expect(structured.offset).toBe(0);
    expect(structured.returnedCount).toBe(7);
    expect(structured.truncated).toBe(false);
  });
});

describe('vatReportTool — payload byte cap', () => {
  /** An income row padded to roughly `bytes` of serialized output. */
  const paddedRecord = (i: number, bytes: number) =>
    vatRecord(`in-${i}`, { image: `https://images.example.com/${'x'.repeat(bytes)}` });

  const serializedBytes = (structured: unknown) =>
    Buffer.byteLength(JSON.stringify(structured), 'utf8');

  it('keeps the shared cap at 60 KB and gives this tool 120 KB', () => {
    expect(MAX_TOOL_RESULT_BYTES).toBe(60_000);
    expect(VAT_REPORT_MAX_RESULT_BYTES).toBe(120_000);
  });

  it('does not truncate a page above 60 KB that fits in 120 KB', async () => {
    const income = Array.from({ length: 70 }, (_, i) => paddedRecord(i, 400));
    const { client } = clientReturning(vatReportData({ income }));
    const structured = structuredOf(await run(client, args()));

    const size = serializedBytes(structured);
    expect(size).toBeGreaterThan(MAX_TOOL_RESULT_BYTES);
    expect(size).toBeLessThanOrEqual(VAT_REPORT_MAX_RESULT_BYTES);
    expect(structured.returnedCount).toBe(70);
    expect(structured.truncated).toBe(false);
  });

  it('truncates past 120 KB by payload size, keeping summary and counts', async () => {
    const income = Array.from({ length: 200 }, (_, i) => paddedRecord(i, 400));
    const { client } = clientReturning(vatReportData({ income }));
    const result = await run(client, args());
    const structured = structuredOf(result);

    expect(serializedBytes(structured)).toBeLessThanOrEqual(VAT_REPORT_MAX_RESULT_BYTES);
    expect(structured.truncated).toBe(true);
    expect(structured.continuation?.reason).toBe('payload_size');
    expect(structured.returnedCount).toBeGreaterThan(0);
    expect(structured.returnedCount).toBeLessThan(200);
    expect((structured.income as unknown[]).length).toBe(structured.returnedCount);
    expect(structured.totalCount).toBe(200);
    expect(structured.counts).toEqual({ income: 200, expenses: 1, missingInfo: 1 });
    expect(structured.summary).toMatchObject({ salesRecordCount: 1, inputsCount: 1 });
    expect(result.content[0]!.text).toContain(
      `call again with offset ${structured.returnedCount}`,
    );
  });
});
