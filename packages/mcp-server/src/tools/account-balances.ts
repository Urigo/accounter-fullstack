import { z } from 'zod';
import type { McpGetAccountBalancesQuery } from '../gql/index.js';
import { DAY_MS, parseCalendarDate, TIMELESS_DATE } from './dates.js';
import { normalizeAmount } from './entity-shapes.js';
import { resultEnvelopeDescription, shapeListResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';
import { memberBusinessIdsInput, SCOPE_DESCRIPTION_SUFFIX } from './scope-input.js';

/**
 * Bank balances: what each bank account held, per currency, as the bank itself
 * reported it.
 *
 * Banks report the running balance after every movement, and Accounter keeps it
 * on each ingested transaction. The newest transaction of an account in a
 * currency therefore carries the newest balance the bank told us about. That is
 * a reported figure, not a sum Accounter computes - but it is only as fresh as
 * the last ingested movement, so every row says when it is from.
 */

export const GET_ACCOUNT_BALANCES_TOOL_NAME = 'accounter_get_account_balances';

/** Hard cap on how many accounts one call may name. */
export const MAX_REQUESTED_ACCOUNTS = 100;

export const ACCOUNT_BALANCES_CAVEATS = [
  "Each balance is the bank's running balance after the newest ingested transaction of that account in that currency - not a live read. A quiet account shows an old balance; check asOfDate.",
  'Pending and future-dated bank movements are not ingested, so they are not reflected.',
  'Bank deposits (פקדונות) and securities held in the account are not part of these balances.',
  'Balances are per currency and never converted. Use byCurrency for totals; never add different currencies.',
] as const;

const getAccountBalancesInput = z.object({
  memberBusinessIds: memberBusinessIdsInput,
  accountIds: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_REQUESTED_ACCOUNTS)
    .optional()
    .describe(
      "Only these financial accounts (ids from a transaction's `account`). Omit for every bank account in scope.",
    ),
  asOfDate: TIMELESS_DATE.optional().describe(
    'Report the balance as it stood at the end of this day (YYYY-MM-DD): the newest transaction on or before it. Omit for the latest.',
  ),
});
type GetAccountBalancesInput = z.infer<typeof getAccountBalancesInput>;

const GET_ACCOUNT_BALANCES_QUERY = /* GraphQL */ `
  query McpGetAccountBalances($accountIds: [UUID!], $asOfDate: TimelessDate) {
    financialAccountBalances(accountIds: $accountIds, asOfDate: $asOfDate) {
      account {
        id
        name
        number
        type
        ... on BankFinancialAccount {
          bankNumber
          branchNumber
        }
      }
      currency
      balance {
        raw
        currency
      }
      asOfDate
      valueDate
      transactionId
      ownerId
    }
  }
`;

type RawBalance = McpGetAccountBalancesQuery['financialAccountBalances'][number];

function normalizeBalance(row: RawBalance, referenceDay: number | null) {
  const account = row.account;
  const asOfDay = parseCalendarDate(row.asOfDate);
  return {
    accountId: account.id,
    accountName: account.name,
    accountNumber: account.number,
    bankNumber: 'bankNumber' in account ? account.bankNumber : null,
    branchNumber: 'branchNumber' in account ? account.branchNumber : null,
    ownerId: row.ownerId,
    currency: row.currency,
    balance: normalizeAmount(row.balance),
    asOfDate: row.asOfDate,
    valueDate: row.valueDate ?? null,
    daysOld:
      referenceDay === null || asOfDay === null
        ? null
        : Math.max(0, Math.round((referenceDay - asOfDay) / DAY_MS)),
    transactionId: row.transactionId,
  };
}
type NormalizedBalance = ReturnType<typeof normalizeBalance>;

/** The only valid aggregation: one total per currency. */
function totalsByCurrency(rows: readonly NormalizedBalance[]) {
  const totals = new Map<string, { accountCount: number; total: number; oldest: string }>();
  for (const row of rows) {
    if (!row.balance) continue;
    const bucket = totals.get(row.currency) ?? { accountCount: 0, total: 0, oldest: row.asOfDate };
    bucket.accountCount += 1;
    bucket.total += row.balance.value;
    if (row.asOfDate < bucket.oldest) bucket.oldest = row.asOfDate;
    totals.set(row.currency, bucket);
  }
  return [...totals.entries()]
    .map(([currency, bucket]) => ({
      currency,
      accountCount: bucket.accountCount,
      total: Math.round(bucket.total * 100) / 100,
      oldestAsOfDate: bucket.oldest,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

async function getAccountBalancesHandler(
  input: GetAccountBalancesInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const data = await context.client.query<McpGetAccountBalancesQuery>(
    {
      query: GET_ACCOUNT_BALANCES_QUERY,
      variables: { accountIds: input.accountIds ?? null, asOfDate: input.asOfDate ?? null },
    },
    context.upstream,
  );

  const referenceDay = input.asOfDate
    ? parseCalendarDate(input.asOfDate)
    : parseCalendarDate(new Date().toISOString().slice(0, 10));
  const rows = data.financialAccountBalances
    .map(row => normalizeBalance(row, referenceDay))
    .sort(
      (a, b) =>
        a.accountNumber.localeCompare(b.accountNumber) || a.currency.localeCompare(b.currency),
    );

  return shapeListResult({
    items: rows,
    itemsKey: 'balances',
    total: rows.length,
    extra: {
      byCurrency: totalsByCurrency(rows),
      caveats: ACCOUNT_BALANCES_CAVEATS,
      asOfDate: input.asOfDate ?? null,
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
    },
    summarize: (shown, total) =>
      total === 0
        ? 'No bank balances found - no bank transactions have been ingested for the accounts in scope.'
        : `${total} balance${total === 1 ? '' : 's'} across ${new Set(rows.map(r => r.accountId)).size} bank account(s)${input.asOfDate ? ` as of ${input.asOfDate}` : ''}; showing ${shown}. Each row is the bank's own running balance after the newest ingested transaction - see asOfDate and daysOld.`,
  });
}

export const getAccountBalancesTool: ToolDefinition<typeof getAccountBalancesInput> = {
  name: GET_ACCOUNT_BALANCES_TOOL_NAME,
  description:
    'Get the balance of each bank account, per currency, as the bank reported it: the running balance after the newest ingested transaction, with the date it is from (`asOfDate`, `daysOld`). ' +
    'Pass `asOfDate` for the balance at the end of a past day. Credit cards are excluded; bank deposits and securities are not part of a bank balance. ' +
    'Amounts are never converted: use `byCurrency` for totals and never add currencies together. Every response carries `caveats`. Read-only. ' +
    resultEnvelopeDescription('balances') +
    ' ' +
    SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: getAccountBalancesInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler: getAccountBalancesHandler,
};
