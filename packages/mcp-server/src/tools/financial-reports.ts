import { z } from 'zod';
import type {
  McpIncomeExpenseSummaryQuery,
  McpIncomeExpenseSummaryQueryVariables,
  McpProfitAndLossQuery,
  McpProfitAndLossQueryVariables,
  McpVatReportQuery,
  McpVatReportQueryVariables,
} from '../gql/index.js';
import { DAY_MS, parseCalendarDate, TIMELESS_DATE } from './dates.js';
import { normalizeAmount, type NormalizedAmount } from './entity-shapes.js';
import { ToolInputError } from './execute.js';
import { shapeListResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';
import {
  assertAuthorizedBusiness,
  businessIdInput,
  SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX,
} from './scope-input.js';

/**
 * Report-level tools (spec §8.2, feedback §1).
 *
 * The connector previously exposed only rows, so an agent asked "how much did we
 * make this year" had to rebuild bookkeeping from raw transactions — the part it
 * is most likely to get wrong. Accounter already computes these reports; these
 * tools just expose them.
 *
 * All three are single-business. That is not only an authorization choice: the
 * upstream resolvers behind `incomeExpenseChart` and `profitAndLossReport` take
 * no owner argument and read it from the forwarded `x-business-scope`, which
 * `execute.ts` narrows using the required `businessId` field. See
 * `businessIdInput` in `scope-input.ts`.
 */

export const INCOME_EXPENSE_SUMMARY_TOOL_NAME = 'accounter_income_expense_summary';
export const PROFIT_AND_LOSS_TOOL_NAME = 'accounter_profit_and_loss';
export const VAT_REPORT_TOOL_NAME = 'accounter_vat_report';

/**
 * Aggregate reports return one row per month, not per transaction, so the
 * ~3-year bound the row-level tools need would only force needless extra calls.
 * Ten years covers "chart my money from the beginning" in a single request.
 */
export const MAX_AGGREGATE_RANGE_DAYS = 3660;

/** Bound on the total years a single P&L call may span (report + references). */
const MAX_REFERENCE_YEARS = 5;
const EARLIEST_REPORT_YEAR = 2000;

const CURRENCIES = [
  'ILS',
  'USD',
  'EUR',
  'GBP',
  'AUD',
  'CAD',
  'JPY',
  'SEK',
  'ETH',
  'GRT',
  'USDC',
] as const;

/** Reject an invalid, inverted, or too-wide range before hitting upstream. */
function assertAggregateRange(fromDate: string, toDate: string): void {
  const from = parseCalendarDate(fromDate);
  const to = parseCalendarDate(toDate);
  if (from === null || to === null) {
    throw new ToolInputError('Invalid fromDate/toDate');
  }
  if (from > to) {
    throw new ToolInputError('fromDate must be on or before toDate');
  }
  if (Math.round((to - from) / DAY_MS) > MAX_AGGREGATE_RANGE_DAYS) {
    throw new ToolInputError(`Date range must not exceed ${MAX_AGGREGATE_RANGE_DAYS} days`);
  }
}

// ---------------------------------------------------------------------------
// Income / expense summary
// ---------------------------------------------------------------------------

const incomeExpenseSummaryInput = z.object({
  businessId: businessIdInput,
  fromDate: TIMELESS_DATE.describe('Start of the reporting period (YYYY-MM-DD).'),
  toDate: TIMELESS_DATE.describe('End of the reporting period (YYYY-MM-DD).'),
  currency: z
    .enum(CURRENCIES)
    .optional()
    .describe(
      'Convert every month to this currency using each transaction’s own historical rate. ' +
        'Defaults to the business’s configured currency.',
    ),
});

type IncomeExpenseSummaryInput = z.infer<typeof incomeExpenseSummaryInput>;

const INCOME_EXPENSE_SUMMARY_QUERY = /* GraphQL */ `
  query McpIncomeExpenseSummary($filters: IncomeExpenseChartFilters!) {
    incomeExpenseChart(filters: $filters) {
      currency
      fromDate
      toDate
      monthlyData {
        date
        income {
          raw
          formatted
          currency
        }
        expense {
          raw
          formatted
          currency
        }
        balance {
          raw
          formatted
          currency
        }
      }
    }
  }
`;

async function incomeExpenseSummaryHandler(
  input: IncomeExpenseSummaryInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  assertAggregateRange(input.fromDate, input.toDate);
  const ownerId = assertAuthorizedBusiness(input.businessId, context);

  const variables: McpIncomeExpenseSummaryQueryVariables = {
    filters: {
      fromDate: input.fromDate,
      toDate: input.toDate,
      ...(input.currency ? { currency: input.currency } : {}),
    },
  };
  const data = await context.client.query<McpIncomeExpenseSummaryQuery>(
    { query: INCOME_EXPENSE_SUMMARY_QUERY, variables },
    context.upstream,
  );

  const chart = data.incomeExpenseChart;
  const months = (chart?.monthlyData ?? []).map(month => ({
    month: month.date,
    income: normalizeAmount(month.income),
    expense: normalizeAmount(month.expense),
    // Named `cumulativeNet` rather than upstream's `balance`: it is a running
    // sum of the period's own flows starting from zero, not an account balance.
    cumulativeNet: normalizeAmount(month.balance),
  }));

  const totals = months.reduce(
    (sum, month) => ({
      income: sum.income + (month.income?.value ?? 0),
      expense: sum.expense + (month.expense?.value ?? 0),
    }),
    { income: 0, expense: 0 },
  );
  const currency = chart?.currency ?? input.currency ?? null;

  return shapeListResult({
    items: months,
    itemsKey: 'months',
    total: months.length,
    extra: {
      businessId: ownerId,
      currency,
      period: { fromDate: input.fromDate, toDate: input.toDate },
      totals: {
        income: totals.income,
        expense: totals.expense,
        net: totals.income - totals.expense,
        currency,
      },
      scope: { businessIds: context.readScope.businessIds },
    },
    summarize: (shown, total) =>
      total === 0
        ? `No transactions between ${input.fromDate} and ${input.toDate}.`
        : `${total} month(s)${shown < total ? ` (showing ${shown})` : ''} from ${input.fromDate} to ` +
          `${input.toDate}: income ${totals.income.toFixed(2)}, expense ${totals.expense.toFixed(2)}, ` +
          `net ${(totals.income - totals.expense).toFixed(2)} ${currency ?? ''}`.trimEnd() +
          '.',
  });
}

export const incomeExpenseSummaryTool: ToolDefinition<typeof incomeExpenseSummaryInput> = {
  name: INCOME_EXPENSE_SUMMARY_TOOL_NAME,
  description:
    'Monthly income and expense totals for one business over a date range, each month converted ' +
    'to a single currency using the historical rates for that period — the fastest way to answer ' +
    '“how much did we make this year” or to chart money over time. Returns one row per month plus ' +
    'period totals. IMPORTANT: `cumulativeNet` is a running sum of cash flows starting from zero ' +
    'for the requested period, NOT an account balance, and it counts credit-card rows alongside ' +
    'the bank rows that settle them, so it overstates movement — treat it as a trend, not a ' +
    'balance, and use `accounter_list_accounts` to understand the account structure. Read-only. ' +
    SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: incomeExpenseSummaryInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'business',
  },
  handler: incomeExpenseSummaryHandler,
};

// ---------------------------------------------------------------------------
// Profit and loss
// ---------------------------------------------------------------------------

const reportYearInput = z
  .number()
  .int()
  .min(EARLIEST_REPORT_YEAR)
  .max(2100)
  .describe('Calendar year to report on, e.g. 2026.');

const profitAndLossInput = z.object({
  businessId: businessIdInput,
  year: reportYearInput,
  referenceYears: z
    .array(reportYearInput)
    .max(MAX_REFERENCE_YEARS)
    .optional()
    .default([])
    .describe(
      `Earlier years to return alongside the report year for comparison (up to ${MAX_REFERENCE_YEARS}).`,
    ),
});

type ProfitAndLossInput = z.infer<typeof profitAndLossInput>;

const PROFIT_AND_LOSS_QUERY = /* GraphQL */ `
  fragment McpProfitAndLossYearFields on ProfitAndLossReportYear {
    year
    revenue {
      amount {
        raw
        formatted
        currency
      }
    }
    costOfSales {
      amount {
        raw
        formatted
        currency
      }
    }
    grossProfit {
      raw
      formatted
      currency
    }
    researchAndDevelopmentExpenses {
      amount {
        raw
        formatted
        currency
      }
    }
    marketingExpenses {
      amount {
        raw
        formatted
        currency
      }
    }
    managementAndGeneralExpenses {
      amount {
        raw
        formatted
        currency
      }
    }
    operatingProfit {
      raw
      formatted
      currency
    }
    financialExpenses {
      amount {
        raw
        formatted
        currency
      }
    }
    otherIncome {
      amount {
        raw
        formatted
        currency
      }
    }
    profitBeforeTax {
      raw
      formatted
      currency
    }
    tax {
      raw
      formatted
      currency
    }
    netProfit {
      raw
      formatted
      currency
    }
  }

  query McpProfitAndLoss($reportYear: Int!, $referenceYears: [Int!]!) {
    profitAndLossReport(reportYear: $reportYear, referenceYears: $referenceYears) {
      report {
        ...McpProfitAndLossYearFields
      }
      reference {
        ...McpProfitAndLossYearFields
      }
    }
  }
`;

type RawProfitAndLossYear = McpProfitAndLossQuery['profitAndLossReport']['report'];

interface NormalizedProfitAndLossYear {
  year: number;
  revenue: NormalizedAmount | null;
  costOfSales: NormalizedAmount | null;
  grossProfit: NormalizedAmount | null;
  researchAndDevelopmentExpenses: NormalizedAmount | null;
  marketingExpenses: NormalizedAmount | null;
  managementAndGeneralExpenses: NormalizedAmount | null;
  operatingProfit: NormalizedAmount | null;
  financialExpenses: NormalizedAmount | null;
  otherIncome: NormalizedAmount | null;
  profitBeforeTax: NormalizedAmount | null;
  tax: NormalizedAmount | null;
  netProfit: NormalizedAmount | null;
}

/**
 * Flatten each line item to its total.
 *
 * Upstream models the expense lines as `ReportCommentary`, which nests a
 * per-sort-code breakdown under `records`. That breakdown is large and is not
 * what a P&L question asks for; a caller who needs it can drill in through the
 * ledger tools.
 */
function normalizeProfitAndLossYear(year: RawProfitAndLossYear): NormalizedProfitAndLossYear {
  return {
    year: year.year,
    revenue: normalizeAmount(year.revenue?.amount),
    costOfSales: normalizeAmount(year.costOfSales?.amount),
    grossProfit: normalizeAmount(year.grossProfit),
    researchAndDevelopmentExpenses: normalizeAmount(year.researchAndDevelopmentExpenses?.amount),
    marketingExpenses: normalizeAmount(year.marketingExpenses?.amount),
    managementAndGeneralExpenses: normalizeAmount(year.managementAndGeneralExpenses?.amount),
    operatingProfit: normalizeAmount(year.operatingProfit),
    financialExpenses: normalizeAmount(year.financialExpenses?.amount),
    otherIncome: normalizeAmount(year.otherIncome?.amount),
    profitBeforeTax: normalizeAmount(year.profitBeforeTax),
    tax: normalizeAmount(year.tax),
    netProfit: normalizeAmount(year.netProfit),
  };
}

async function profitAndLossHandler(
  input: ProfitAndLossInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const ownerId = assertAuthorizedBusiness(input.businessId, context);
  if (input.referenceYears.includes(input.year)) {
    throw new ToolInputError('referenceYears must not contain the report year');
  }

  const variables: McpProfitAndLossQueryVariables = {
    reportYear: input.year,
    referenceYears: [...input.referenceYears],
  };
  const data = await context.client.query<McpProfitAndLossQuery>(
    { query: PROFIT_AND_LOSS_QUERY, variables },
    context.upstream,
  );

  const report = normalizeProfitAndLossYear(data.profitAndLossReport.report);
  const reference = (data.profitAndLossReport.reference ?? []).map(normalizeProfitAndLossYear);

  // A P&L is one object, not a list, so the items array holds the report year
  // followed by its reference years — that keeps the byte guard meaningful
  // (trailing reference years drop first) instead of all-or-nothing.
  return shapeListResult({
    items: [report, ...reference],
    itemsKey: 'years',
    total: 1 + reference.length,
    extra: {
      businessId: ownerId,
      reportYear: input.year,
      scope: { businessIds: context.readScope.businessIds },
    },
    summarize: () =>
      `Profit and loss for ${input.year}: revenue ${report.revenue?.formatted ?? 'n/a'}, ` +
      `operating profit ${report.operatingProfit?.formatted ?? 'n/a'}, ` +
      `net profit ${report.netProfit?.formatted ?? 'n/a'}` +
      (reference.length > 0
        ? ` (with ${reference.length} reference year(s): ${reference.map(y => y.year).join(', ')}).`
        : '.'),
  });
}

export const profitAndLossTool: ToolDefinition<typeof profitAndLossInput> = {
  name: PROFIT_AND_LOSS_TOOL_NAME,
  description:
    'The accountant-grade profit and loss statement for one business and calendar year, computed ' +
    'from the double-entry ledger: revenue, cost of sales, gross profit, R&D / marketing / ' +
    'management-and-general expenses, operating profit, financial expenses, other income, profit ' +
    'before tax, tax, and net profit. Pass `referenceYears` for year-over-year comparison. Prefer ' +
    'this over deriving profitability from transactions or documents — the ledger is authoritative. ' +
    'Read-only. ' +
    SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: profitAndLossInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'business',
  },
  handler: profitAndLossHandler,
};

// ---------------------------------------------------------------------------
// VAT report
// ---------------------------------------------------------------------------

const vatReportInput = z.object({
  businessId: businessIdInput,
  month: TIMELESS_DATE.describe(
    'Any date within the reporting month (YYYY-MM-DD); the report covers that whole month.',
  ),
  flow: z
    .enum(['ALL', 'INCOME', 'EXPENSE'])
    .optional()
    .default('ALL')
    .describe('Restrict to income (output VAT) or expense (input VAT) records.'),
  includeRecords: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Include the individual per-document records (default false — the totals answer most questions).',
    ),
});

type VatReportInput = z.infer<typeof vatReportInput>;

const VAT_REPORT_QUERY = /* GraphQL */ `
  fragment McpVatRecordFields on VatReportRecord {
    chargeId
    documentId
    documentSerial
    documentDate
    chargeDate
    business {
      id
      name
    }
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
    localVatAfterDeduction {
      raw
      formatted
      currency
    }
    vatNumber
    isProperty
  }

  query McpVatReport($filters: VatReportFilter) {
    vatReport(filters: $filters) {
      income {
        ...McpVatRecordFields
      }
      expenses {
        ...McpVatRecordFields
      }
    }
  }
`;

type RawVatRecord = McpVatReportQuery['vatReport']['income'][number];

function normalizeVatRecord(record: RawVatRecord) {
  return {
    chargeId: record.chargeId,
    documentId: record.documentId ?? null,
    documentSerial: record.documentSerial ?? null,
    documentDate: record.documentDate ?? null,
    chargeDate: record.chargeDate ?? null,
    counterparty: record.business ? { id: record.business.id, name: record.business.name } : null,
    amount: normalizeAmount(record.amount),
    localAmount: normalizeAmount(record.localAmount),
    localVat: normalizeAmount(record.localVat),
    localVatAfterDeduction: normalizeAmount(record.localVatAfterDeduction),
    vatNumber: record.vatNumber ?? null,
    isProperty: record.isProperty,
  };
}

/** Sum the deductible local VAT and local amounts across a side of the report. */
function sumVat(records: readonly ReturnType<typeof normalizeVatRecord>[]) {
  return records.reduce(
    (totals, record) => ({
      count: totals.count + 1,
      amount: totals.amount + (record.localAmount?.value ?? 0),
      vat: totals.vat + (record.localVatAfterDeduction?.value ?? record.localVat?.value ?? 0),
    }),
    { count: 0, amount: 0, vat: 0 },
  );
}

async function vatReportHandler(
  input: VatReportInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  if (parseCalendarDate(input.month) === null) {
    throw new ToolInputError('Invalid month');
  }
  const ownerId = assertAuthorizedBusiness(input.businessId, context);

  const variables: McpVatReportQueryVariables = {
    filters: {
      // Passed explicitly even though `x-business-scope` already narrows
      // upstream — this resolver takes the entity id, so state it (mirrors the
      // `byOwners` reasoning in `charges.ts`).
      financialEntityId: ownerId,
      monthDate: input.month,
      chargesType: input.flow,
    },
  };
  const data = await context.client.query<McpVatReportQuery>(
    { query: VAT_REPORT_QUERY, variables },
    context.upstream,
  );

  const income = (data.vatReport?.income ?? []).map(normalizeVatRecord);
  const expenses = (data.vatReport?.expenses ?? []).map(normalizeVatRecord);
  const incomeTotals = sumVat(income);
  const expenseTotals = sumVat(expenses);
  const netVat = incomeTotals.vat - expenseTotals.vat;

  const totals = {
    income: incomeTotals,
    expenses: expenseTotals,
    // Positive means VAT owed to the tax authority; negative means refundable.
    netVatDue: netVat,
  };

  // The records are the bulk of the payload and are opt-in, so when they are
  // omitted the tool still reports how many there were.
  const records = input.includeRecords ? [...income, ...expenses] : [];

  return shapeListResult({
    items: records,
    itemsKey: 'records',
    total: input.includeRecords ? income.length + expenses.length : 0,
    extra: {
      businessId: ownerId,
      month: input.month,
      flow: input.flow,
      totals,
      recordCounts: { income: income.length, expenses: expenses.length },
      scope: { businessIds: context.readScope.businessIds },
    },
    summarize: () =>
      `VAT for ${input.month}: output VAT ${incomeTotals.vat.toFixed(2)} on ${incomeTotals.count} ` +
      `income record(s), input VAT ${expenseTotals.vat.toFixed(2)} on ${expenseTotals.count} ` +
      `expense record(s); net VAT ${netVat >= 0 ? 'due' : 'refundable'} ${Math.abs(netVat).toFixed(2)}.`,
  });
}

export const vatReportTool: ToolDefinition<typeof vatReportInput> = {
  name: VAT_REPORT_TOOL_NAME,
  description:
    'The monthly VAT report for one business: output VAT on income, input VAT on expenses, and ' +
    'the resulting net VAT due (positive) or refundable (negative), all in local currency. Set ' +
    '`includeRecords` to also return the individual per-document records. Read-only. ' +
    SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: vatReportInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'business',
  },
  handler: vatReportHandler,
};
