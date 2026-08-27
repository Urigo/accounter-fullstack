import { z } from 'zod';
import type { McpGetLedgerRecordsQuery, McpGetLedgerRecordsQueryVariables } from '../gql/index.js';
import { DAY_MS, parseCalendarDate, TIMELESS_DATE } from './dates.js';
import { normalizeAmount, normalizeEntity, type NormalizedAmount } from './entity-shapes.js';
import { ToolInputError } from './execute.js';
import { resultEnvelopeDescription, shapeListResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';
import { memberBusinessIdsInput, SCOPE_DESCRIPTION_SUFFIX } from './scope-input.js';

/**
 * Read-only ledger-records search.
 *
 * The double-entry ledger is the accounting source of truth, so this is the
 * tool to answer "what was posted against account X" or "show me the entries
 * behind charge Y" — questions the charge-level tools can only approximate.
 *
 * Filters mirror the upstream `ledgerRecordsByFilters` query: the three date
 * axes a record has (invoice date, value date, or either), the financial entity
 * sitting in any of the four debit/credit account slots, the owning business,
 * and the charge. Every returned row carries its `ownerId` and `chargeId`, so a
 * result spanning businesses or charges can be grouped without a second call.
 */

export const GET_LEDGER_RECORDS_TOOL_NAME = 'accounter_get_ledger_records';

/** Hard caps keeping responses bounded (spec §9.1, §9.3). */
export const MAX_LEDGER_RECORDS = 500;
export const DEFAULT_LEDGER_RECORDS = 200;
export const MAX_LEDGER_DATE_RANGE_DAYS = 1096; // ~3 years
export const MAX_LEDGER_FILTER_IDS = 50;

/**
 * The account slots a financial entity can occupy on a record. Named after the
 * `debitAccount1`/`creditAccount2`/… fields the response returns, so a filter
 * value and the field it matches read the same.
 */
const LEDGER_ACCOUNTS = [
  'DEBIT_ACCOUNT_1',
  'DEBIT_ACCOUNT_2',
  'CREDIT_ACCOUNT_1',
  'CREDIT_ACCOUNT_2',
] as const;

const idList = (what: string) =>
  z
    .array(z.string().min(1))
    .max(MAX_LEDGER_FILTER_IDS)
    .optional()
    .describe(`Only records ${what}.`);

const getLedgerRecordsInput = z.object({
  memberBusinessIds: memberBusinessIdsInput,
  fromInvoiceDate: TIMELESS_DATE.optional().describe(
    'Only records with an invoice date on/after this date (YYYY-MM-DD).',
  ),
  toInvoiceDate: TIMELESS_DATE.optional().describe(
    'Only records with an invoice date on/before this date (YYYY-MM-DD).',
  ),
  fromValueDate: TIMELESS_DATE.optional().describe(
    'Only records with a value date on/after this date (YYYY-MM-DD).',
  ),
  toValueDate: TIMELESS_DATE.optional().describe(
    'Only records with a value date on/before this date (YYYY-MM-DD).',
  ),
  fromDate: TIMELESS_DATE.optional().describe(
    'Only records whose invoice date OR value date is on/after this date (YYYY-MM-DD). Use this when you do not care which of the two dates matches.',
  ),
  toDate: TIMELESS_DATE.optional().describe(
    'Only records whose invoice date OR value date is on/before this date (YYYY-MM-DD).',
  ),
  financialEntityIds: idList(
    'referencing any of these financial entities (businesses or tax categories)',
  ),
  financialEntityAccounts: z
    .array(z.enum(LEDGER_ACCOUNTS))
    .max(LEDGER_ACCOUNTS.length)
    .optional()
    .describe(
      'Which account slots `financialEntityIds` is matched against. Omit to match any of the four.',
    ),
  chargeIds: idList('belonging to any of these charges'),
  limit: z
    .number()
    .int()
    .positive()
    .max(MAX_LEDGER_RECORDS)
    .optional()
    .default(DEFAULT_LEDGER_RECORDS)
    .describe(`Maximum records to return (capped at ${MAX_LEDGER_RECORDS}).`),
});

type GetLedgerRecordsInput = z.infer<typeof getLedgerRecordsInput>;

const GET_LEDGER_RECORDS_QUERY = /* GraphQL */ `
  query McpGetLedgerRecords($filters: LedgerRecordsFilters) {
    ledgerRecordsByFilters(filters: $filters) {
      id
      ownerId
      chargeId
      invoiceDate
      valueDate
      description
      reference
      debitAmount1 {
        raw
        formatted
        currency
      }
      debitAmount2 {
        raw
        formatted
        currency
      }
      creditAmount1 {
        raw
        formatted
        currency
      }
      creditAmount2 {
        raw
        formatted
        currency
      }
      localCurrencyDebitAmount1 {
        raw
        formatted
        currency
      }
      localCurrencyDebitAmount2 {
        raw
        formatted
        currency
      }
      localCurrencyCreditAmount1 {
        raw
        formatted
        currency
      }
      localCurrencyCreditAmount2 {
        raw
        formatted
        currency
      }
      debitAccount1 {
        id
        name
      }
      debitAccount2 {
        id
        name
      }
      creditAccount1 {
        id
        name
      }
      creditAccount2 {
        id
        name
      }
    }
  }
`;

/** A single record as returned by the generated `McpGetLedgerRecords` query. */
type RawLedgerRecord = McpGetLedgerRecordsQuery['ledgerRecordsByFilters'][number];

/** One side of a double-entry posting: the account and what was posted to it. */
interface NormalizedLedgerEntry {
  account: { id: string; name: string | null } | null;
  amount: NormalizedAmount | null;
  localCurrencyAmount: NormalizedAmount | null;
}

/** Normalized ledger record returned to the caller. */
export interface NormalizedLedgerRecord {
  id: string;
  /** Owning business, so multi-business results can be grouped by the model. */
  ownerId: string | null;
  /** Charge the record belongs to — feed it to `accounter_get_charges`. */
  chargeId: string;
  invoiceDate: string;
  valueDate: string;
  description: string | null;
  reference: string | null;
  debit1: NormalizedLedgerEntry;
  debit2: NormalizedLedgerEntry;
  credit1: NormalizedLedgerEntry;
  credit2: NormalizedLedgerEntry;
}

/** Reject an inverted or too-wide range on each of the three date axes. */
function assertDateRanges(input: GetLedgerRecordsInput): void {
  const axes = [
    { label: 'invoice', from: input.fromInvoiceDate, to: input.toInvoiceDate },
    { label: 'value', from: input.fromValueDate, to: input.toValueDate },
    { label: '', from: input.fromDate, to: input.toDate },
  ] as const;

  for (const { label, from, to } of axes) {
    const prefix = label ? `${label} ` : '';
    let fromMs: number | undefined;
    let toMs: number | undefined;
    // Validate each supplied date on its own — a value can match the format
    // regex yet be an impossible calendar date (e.g. 2026-02-31).
    if (from !== undefined) {
      const parsed = parseCalendarDate(from);
      if (parsed === null) {
        throw new ToolInputError(`Invalid ${prefix}from date`);
      }
      fromMs = parsed;
    }
    if (to !== undefined) {
      const parsed = parseCalendarDate(to);
      if (parsed === null) {
        throw new ToolInputError(`Invalid ${prefix}to date`);
      }
      toMs = parsed;
    }
    if (fromMs !== undefined && toMs !== undefined) {
      if (fromMs > toMs) {
        throw new ToolInputError(
          `The ${prefix}from date must be on or before the ${prefix}to date`,
        );
      }
      if (Math.round((toMs - fromMs) / DAY_MS) > MAX_LEDGER_DATE_RANGE_DAYS) {
        throw new ToolInputError(`Date range must not exceed ${MAX_LEDGER_DATE_RANGE_DAYS} days`);
      }
    }
  }
}

function buildFilters(
  input: GetLedgerRecordsInput,
  memberBusinessIds: readonly string[],
): NonNullable<McpGetLedgerRecordsQueryVariables['filters']> {
  const filters: NonNullable<McpGetLedgerRecordsQueryVariables['filters']> = {
    // Ask upstream for one extra row so a full page can be reported as
    // truncated instead of silently looking like the complete answer.
    limit: input.limit + 1,
  };
  // Always scope to the authorized businesses. Kept as an explicit predicate
  // even though `x-business-scope` narrows via RLS upstream: defense in depth,
  // and the tool stays correct if upstream ever runs under a scope-bypassing
  // role.
  if (memberBusinessIds.length > 0) {
    filters.ownerIds = [...memberBusinessIds];
  }
  if (input.fromInvoiceDate) filters.fromInvoiceDate = input.fromInvoiceDate;
  if (input.toInvoiceDate) filters.toInvoiceDate = input.toInvoiceDate;
  if (input.fromValueDate) filters.fromValueDate = input.fromValueDate;
  if (input.toValueDate) filters.toValueDate = input.toValueDate;
  if (input.fromDate) filters.fromAnyDate = input.fromDate;
  if (input.toDate) filters.toAnyDate = input.toDate;
  if (input.financialEntityIds?.length) {
    filters.financialEntityIds = [...input.financialEntityIds];
  }
  if (input.financialEntityAccounts?.length) {
    filters.financialEntityAccounts = [...input.financialEntityAccounts];
  }
  if (input.chargeIds?.length) filters.chargeIds = [...input.chargeIds];
  return filters;
}

function normalizeRecord(record: RawLedgerRecord): NormalizedLedgerRecord {
  return {
    id: record.id,
    ownerId: record.ownerId ?? null,
    chargeId: record.chargeId,
    invoiceDate: record.invoiceDate,
    valueDate: record.valueDate,
    description: record.description ?? null,
    reference: record.reference ?? null,
    debit1: {
      account: normalizeEntity(record.debitAccount1),
      amount: normalizeAmount(record.debitAmount1),
      localCurrencyAmount: normalizeAmount(record.localCurrencyDebitAmount1),
    },
    debit2: {
      account: normalizeEntity(record.debitAccount2),
      amount: normalizeAmount(record.debitAmount2),
      localCurrencyAmount: normalizeAmount(record.localCurrencyDebitAmount2),
    },
    credit1: {
      account: normalizeEntity(record.creditAccount1),
      amount: normalizeAmount(record.creditAmount1),
      localCurrencyAmount: normalizeAmount(record.localCurrencyCreditAmount1),
    },
    credit2: {
      account: normalizeEntity(record.creditAccount2),
      amount: normalizeAmount(record.creditAmount2),
      localCurrencyAmount: normalizeAmount(record.localCurrencyCreditAmount2),
    },
  };
}

async function handler(
  input: GetLedgerRecordsInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  assertDateRanges(input);

  const variables: McpGetLedgerRecordsQueryVariables = {
    filters: buildFilters(input, context.readScope.memberBusinessIds),
  };
  const data = await context.client.query<McpGetLedgerRecordsQuery>(
    { query: GET_LEDGER_RECORDS_QUERY, variables },
    context.upstream,
  );

  const all = data.ledgerRecordsByFilters ?? [];
  // The probe row (limit + 1) only tells us more exist; it is not returned.
  const hasMore = all.length > input.limit;
  const records = all.slice(0, input.limit).map(normalizeRecord);

  const scope = { memberBusinessIds: context.readScope.memberBusinessIds };
  const scopeNote =
    scope.memberBusinessIds.length > 1
      ? ` across ${scope.memberBusinessIds.length} businesses`
      : '';

  return shapeListResult({
    items: records,
    itemsKey: 'ledgerRecords',
    // `total` is unknown when capped — report at least one beyond what is shown
    // so the result is correctly marked truncated with a continuation hint.
    total: hasMore ? records.length + 1 : records.length,
    extra: { scope, limit: input.limit },
    summarize: (shown, _total, truncated) =>
      shown === 0
        ? `No ledger records matched the given filters${scopeNote}.`
        : `Found ${shown} ledger record(s)${scopeNote}${
            truncated ? ' (more available — narrow the filters or raise `limit`)' : ''
          }.`,
  });
}

export const getLedgerRecordsTool: ToolDefinition<typeof getLedgerRecordsInput> = {
  name: GET_LEDGER_RECORDS_TOOL_NAME,
  description:
    'Search double-entry ledger records within your authorized businesses. Filter by invoice date, value date, or either; by the financial entity in any of the debit/credit account slots; and by charge id. Each row reports its `ownerId` and `chargeId`. Read-only. ' +
    resultEnvelopeDescription('ledgerRecords') +
    ' ' +
    SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: getLedgerRecordsInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler,
};
