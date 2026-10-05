import { z } from 'zod';
import type { McpVatReportQuery, McpVatReportQueryVariables } from '../../gql/index.js';
import { chargeTypeFromTypename, normalizeAmount, normalizeEntity } from '../entity-shapes.js';
import { resultEnvelopeDescription, shapeListResult } from '../output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from '../registry.js';
import { SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX } from '../scope-input.js';
import { assertMemberBusiness, memberBusinessIdInput } from './shared.js';

/**
 * The monthly VAT report for one business — a thin forwarder of the upstream
 * `vatReport` query.
 *
 * Deliberately no domain logic here: which documents qualify, income vs
 * expense, the VAT figures, the PCN874 header totals (`summary`) and the
 * missing-info verdict are all computed server-side. The MCP only maps the
 * input (`month` → `monthDate`, `memberBusinessId` → `financialEntityId`),
 * normalizes rows into the shared MCP shapes (`normalizeAmount`,
 * `normalizeEntity`, `chargeTypeFromTypename`), tags them with the reported
 * business as `ownerId` like the balance report does, and bounds the size.
 *
 * - `chargesType` is never sent: the upstream filter is inverted (#4604). Add it
 *   as an input once that is fixed (`summary` ignores it by design).
 * - The server has no paging, so every call fetches the whole month and the
 *   tool slices one `section` by `offset`/`limit`. No caching: each page
 *   re-queries.
 * - The call is long-running: upstream validates every charge in the month to
 *   build `missingInfo`, which can far outlast the ordinary read budget.
 * - It gets its own 120 KB payload cap instead of the shared 60 KB
 *   `MAX_TOOL_RESULT_BYTES`: an income/expense row forwards ~20 fields, so 60 KB
 *   would cut a busy month into many re-queries of an expensive report. The
 *   shared cap is untouched for every other tool.
 */

export const VAT_REPORT_TOOL_NAME = 'accounter_vat_report';

/** Per-tool payload cap (see file header); the shared cap stays at 60 KB. */
export const VAT_REPORT_MAX_RESULT_BYTES = 120_000;

/** Max rows per page, matching the charge search's `MAX_PAGE_SIZE`. */
export const VAT_REPORT_MAX_PAGE_SIZE = 500;

/** The report buckets a caller can page through, one per call. */
export const VAT_REPORT_SECTIONS = ['income', 'expenses', 'missingInfo'] as const;

type VatReportSection = (typeof VAT_REPORT_SECTIONS)[number];

const vatReportInput = z.object({
  memberBusinessId: memberBusinessIdInput,
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM with a month from 01 to 12')
    .describe('The VAT reporting month, as YYYY-MM (e.g. 2026-03).'),
  section: z
    .enum(VAT_REPORT_SECTIONS)
    .describe(
      'Which part of the report to return: `income` (sales documents), `expenses` (input ' +
        'documents) or `missingInfo` (charges in the month that still fail validation). ' +
        '`counts` and `summary` come back whichever you pick.',
    ),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe(
      'Index of the first row of the section to return (default 0). To continue a truncated ' +
        'result, pass the previous `offset` + `returnedCount`.',
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(VAT_REPORT_MAX_PAGE_SIZE)
    .optional()
    .default(VAT_REPORT_MAX_PAGE_SIZE)
    .describe(
      `Max rows to return from the section (1–${VAT_REPORT_MAX_PAGE_SIZE}, default ` +
        `${VAT_REPORT_MAX_PAGE_SIZE}). The payload size cap may return fewer.`,
    ),
});

type VatReportInput = z.infer<typeof vatReportInput>;

const VAT_REPORT_QUERY = /* GraphQL */ `
  query McpVatReport($filters: VatReportFilter) {
    vatReport(filters: $filters) {
      income {
        chargeAccountantStatus
        chargeId
        documentId
        business {
          id
          name
        }
        vatNumber
        image
        documentSerial
        documentDate
        allocationNumber
        chargeDate
        amount {
          raw
          formatted
          currency
        }
        localAmount {
          raw
          formatted
          currency
        }
        localVat {
          raw
          formatted
          currency
        }
        foreignVat {
          raw
          formatted
          currency
        }
        foreignVatAfterDeduction {
          raw
          formatted
          currency
        }
        localVatAfterDeduction {
          raw
          formatted
          currency
        }
        roundedLocalVatAfterDeduction {
          raw
          formatted
          currency
        }
        taxReducedLocalAmount {
          raw
          formatted
          currency
        }
        taxReducedForeignAmount {
          raw
          formatted
          currency
        }
        recordType
        isProperty
      }
      expenses {
        chargeAccountantStatus
        chargeId
        documentId
        business {
          id
          name
        }
        vatNumber
        image
        documentSerial
        documentDate
        allocationNumber
        chargeDate
        amount {
          raw
          formatted
          currency
        }
        localAmount {
          raw
          formatted
          currency
        }
        localVat {
          raw
          formatted
          currency
        }
        foreignVat {
          raw
          formatted
          currency
        }
        foreignVatAfterDeduction {
          raw
          formatted
          currency
        }
        localVatAfterDeduction {
          raw
          formatted
          currency
        }
        roundedLocalVatAfterDeduction {
          raw
          formatted
          currency
        }
        taxReducedLocalAmount {
          raw
          formatted
          currency
        }
        taxReducedForeignAmount {
          raw
          formatted
          currency
        }
        recordType
        isProperty
      }
      missingInfo {
        __typename
        id
        userDescription
        minEventDate
        minDocumentsDate
        totalAmount {
          raw
          formatted
          currency
        }
        counterparty {
          id
          name
        }
        accountantApproval
        validationData {
          missingInfo
        }
      }
      summary {
        taxableSalesAmount {
          raw
          formatted
          currency
        }
        taxableSalesVat {
          raw
          formatted
          currency
        }
        salesRecordCount
        zeroValOrExemptSalesAmount {
          raw
          formatted
          currency
        }
        otherInputsVat {
          raw
          formatted
          currency
        }
        equipmentInputsVat {
          raw
          formatted
          currency
        }
        inputsCount
        totalVat {
          raw
          formatted
          currency
        }
      }
    }
  }
`;

type VatReport = McpVatReportQuery['vatReport'];
type RawVatRecord = VatReport['income'][number];
type RawMissingInfoCharge = VatReport['missingInfo'][number];

/** An income/expense row: every `VatReportRecord` field, amounts normalized. */
function toRecordRow(record: RawVatRecord, ownerId: string) {
  return {
    chargeId: record.chargeId,
    documentId: record.documentId ?? null,
    ownerId,
    chargeAccountantStatus: record.chargeAccountantStatus ?? null,
    business: normalizeEntity(record.business),
    vatNumber: record.vatNumber ?? null,
    image: record.image ?? null,
    documentSerial: record.documentSerial ?? null,
    documentDate: record.documentDate ?? null,
    allocationNumber: record.allocationNumber ?? null,
    chargeDate: record.chargeDate ?? null,
    // Upstream drops zero values, so a null amount below means zero.
    amount: normalizeAmount(record.amount),
    localAmount: normalizeAmount(record.localAmount),
    localVat: normalizeAmount(record.localVat),
    foreignVat: normalizeAmount(record.foreignVat),
    foreignVatAfterDeduction: normalizeAmount(record.foreignVatAfterDeduction),
    localVatAfterDeduction: normalizeAmount(record.localVatAfterDeduction),
    roundedLocalVatAfterDeduction: normalizeAmount(record.roundedLocalVatAfterDeduction),
    taxReducedLocalAmount: normalizeAmount(record.taxReducedLocalAmount),
    taxReducedForeignAmount: normalizeAmount(record.taxReducedForeignAmount),
    recordType: record.recordType,
    isProperty: record.isProperty,
  };
}

/** A compact missing-info row; `accounter_get_charges` has the full charge. */
function toMissingInfoRow(charge: RawMissingInfoCharge, ownerId: string) {
  return {
    chargeId: charge.id,
    ownerId,
    chargeType: chargeTypeFromTypename(charge.__typename),
    description: charge.userDescription ?? null,
    minEventDate: charge.minEventDate ?? null,
    minDocumentsDate: charge.minDocumentsDate ?? null,
    amount: normalizeAmount(charge.totalAmount),
    counterparty: normalizeEntity(charge.counterparty),
    accountantStatus: charge.accountantApproval,
    // Forwarded verbatim: the server's validation reasons, not an MCP verdict.
    missing: charge.validationData?.missingInfo ?? [],
  };
}

/** The PCN874 header totals, as filed. Pure reshaping — never recomputed here. */
function toSummary(summary: VatReport['summary'] | null | undefined) {
  if (!summary) {
    return null;
  }
  return {
    taxableSalesAmount: normalizeAmount(summary.taxableSalesAmount),
    taxableSalesVat: normalizeAmount(summary.taxableSalesVat),
    salesRecordCount: summary.salesRecordCount,
    zeroValOrExemptSalesAmount: normalizeAmount(summary.zeroValOrExemptSalesAmount),
    otherInputsVat: normalizeAmount(summary.otherInputsVat),
    equipmentInputsVat: normalizeAmount(summary.equipmentInputsVat),
    inputsCount: summary.inputsCount,
    totalVat: normalizeAmount(summary.totalVat),
  };
}

function describeTotalVat(summary: ReturnType<typeof toSummary>): string {
  const totalVat = summary?.totalVat;
  if (!totalVat) {
    return 'total VAT unavailable';
  }
  if (totalVat.value > 0) {
    return `total VAT ${totalVat.formatted} to pay`;
  }
  if (totalVat.value < 0) {
    return `total VAT ${totalVat.formatted} refund`;
  }
  return `total VAT ${totalVat.formatted} (nothing to pay or refund)`;
}

async function handler(input: VatReportInput, context: ToolExecutionContext): Promise<ToolResult> {
  const ownerId = assertMemberBusiness(context, input.memberBusinessId);

  // `chargesType` is deliberately absent: the upstream filter is inverted
  // (#4604), so the tool always asks for the unfiltered report.
  const variables: McpVatReportQueryVariables = {
    filters: { monthDate: `${input.month}-01`, financialEntityId: ownerId },
  };
  const data = await context.client.query<McpVatReportQuery>(
    { query: VAT_REPORT_QUERY, variables },
    context.upstream,
    // Upstream validates every charge in the month before it answers.
    { longRunning: true },
  );

  // Defend against a null/absent report or bucket from upstream.
  const report = data.vatReport as VatReport | null | undefined;
  const income = report?.income ?? [];
  const expenses = report?.expenses ?? [];
  const missingInfo = report?.missingInfo ?? [];
  const counts: Record<VatReportSection, number> = {
    income: income.length,
    expenses: expenses.length,
    missingInfo: missingInfo.length,
  };
  const summary = toSummary(report?.summary);

  const { section, offset, limit } = input;
  const bucketLength = counts[section];
  const end = offset + limit;
  const page: ReadonlyArray<ReturnType<typeof toRecordRow> | ReturnType<typeof toMissingInfoRow>> =
    section === 'missingInfo'
      ? missingInfo.slice(offset, end).map(charge => toMissingInfoRow(charge, ownerId))
      : (section === 'income' ? income : expenses)
          .slice(offset, end)
          .map(record => toRecordRow(record, ownerId));

  return shapeListResult({
    items: page,
    itemsKey: section,
    // `total` is the number of rows from `offset` to the end of the section,
    // not the section's full size. `shapeListResult` marks a result truncated
    // when it returns fewer than `total`, so the full size would flag every page
    // after the first as truncated — the last one included — and the model
    // would page forever. Counted from `offset`, `truncated` means exactly
    // "more rows remain: call again with `offset` + `returnedCount`" (reason
    // `result_cap` when `limit` stopped it, `payload_size` when the byte cap
    // did). The full size of every section is in `counts`.
    total: Math.max(bucketLength - offset, 0),
    maxBytes: VAT_REPORT_MAX_RESULT_BYTES,
    extra: {
      memberBusinessId: ownerId,
      month: input.month,
      section,
      offset,
      counts,
      summary,
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
    },
    summarize: (shown, _remaining, truncated) => {
      const rows =
        shown === 0
          ? `no ${section} rows from offset ${offset} (${bucketLength} in total)`
          : `${section} rows ${offset + 1}–${offset + shown} of ${bucketLength}`;
      const next = truncated ? `; call again with offset ${offset + shown} for more` : '';
      return `VAT report for ${input.month}: ${describeTotalVat(summary)}. Showing ${rows}${next}.`;
    },
  });
}

export const vatReportTool: ToolDefinition<typeof vatReportInput> = {
  name: VAT_REPORT_TOOL_NAME,
  description:
    'Get the monthly VAT report for one of your businesses: the documents that count toward the ' +
    "month's VAT filing, one document per row (a charge can appear on several rows), plus the " +
    'charges in the month that still fail validation. Each call returns one `section` — `income` ' +
    '(sales documents), `expenses` (input documents) or `missingInfo` (charges with their `missing` ' +
    'reasons) — paged with `offset`/`limit`; `counts` gives the size of all three sections. ' +
    "`summary` is the month's PCN874 header totals as filed (whole month, local currency; " +
    '`totalVat` positive = to pay, negative = refund), returned on every call: prefer it over ' +
    'summing rows. A null amount means zero. Every row carries the reported business as ' +
    '`ownerId`. For what the fields mean, call `accounter_explain_terminology` with topic ' +
    '`report`. Requires business owner or accountant role. ' +
    resultEnvelopeDescription('<section>') +
    ' The key is the requested section (`income`, `expenses` or `missingInfo`), and `totalCount` ' +
    'counts the rows from `offset` to the end of it; to continue, call again with `offset` + ' +
    '`returnedCount`. ' +
    SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: vatReportInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'business',
  },
  handler,
};
