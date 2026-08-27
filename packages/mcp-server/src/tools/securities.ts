import { z } from 'zod';
import { ToolInputError } from '../errors/taxonomy.js';
import type { McpGetSecurityExecutionsQuery, McpListSecurityHoldingsQuery } from '../gql/index.js';
import { parseCalendarDate, TIMELESS_DATE } from './dates.js';
import { normalizeAmount } from './entity-shapes.js';
import { resultEnvelopeDescription, shapeListResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';
import { memberBusinessIdsInput, SCOPE_DESCRIPTION_SUFFIX } from './scope-input.js';

/**
 * Securities: what the tenant holds, and the trades behind it.
 *
 * Two tools over the same domain. `accounter_list_security_holdings` is the
 * portfolio — one row per security with the position its executions add up to.
 * `accounter_get_security_executions` is the trade history, filtered and paged.
 *
 * Everything here is derived rather than reported, and the derivation has real
 * limits (no bank balance, no market prices, per-security currencies that must
 * never be added together). Those limits ride on every response as `caveats`
 * rather than living only in the tool description: a model that reads the rows
 * and not the schema still has to see them.
 */

export const LIST_SECURITY_HOLDINGS_TOOL_NAME = 'accounter_list_security_holdings';
export const GET_SECURITY_EXECUTIONS_TOOL_NAME = 'accounter_get_security_executions';

/** Hard cap on holdings rows returned in one call. */
export const MAX_SECURITY_HOLDINGS = 300;
/** Default holdings rows — roughly what fits the result byte budget untruncated. */
export const DEFAULT_SECURITY_HOLDINGS = 150;
/** Hard cap on executions per page. */
export const MAX_SECURITY_EXECUTIONS_PAGE_SIZE = 200;
export const DEFAULT_SECURITY_EXECUTIONS_PAGE_SIZE = 100;
/** Hard cap on how many securities one identity filter may name. */
export const MAX_REQUESTED_SECURITIES = 50;

/**
 * What is true of every number these tools return.
 *
 * Emitted on the wire, not just documented. The position is arithmetic over a
 * scraped trade history, and each of these is a way that arithmetic can be read
 * as more than it is.
 */
export const SECURITIES_CAVEATS = [
  'Positions are derived by adding up ingested executions. The bank does not report a holding, so these are not a reported balance.',
  'Anything held before historyStartDate is not counted, and splits or corporate actions with no execution row are invisible.',
  "Amounts are in each security's own trade currency and are never converted. Never sum across currencies, and never sum quantities or average costs at all.",
  'No market prices are available: current value and unrealized profit or loss are unknown.',
  'A negative quantity means the scraped history starts mid-life - a data-quality signal, not a short position. A null amount means nothing was ingested, not zero.',
] as const;

// ---------------------------------------------------------------------------
// Holdings
// ---------------------------------------------------------------------------

const listSecurityHoldingsInput = z.object({
  memberBusinessIds: memberBusinessIdsInput,
  includeClosed: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Include securities that were traded but are no longer held (sold out, or with nothing ingested against them). Off by default: closed positions are the bulk of a long-lived portfolio.',
    ),
  search: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .describe(
      'Case-insensitive substring matched against the security name (English or Hebrew), symbol, ISIN, exchange, currency and every source identifier.',
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(MAX_SECURITY_HOLDINGS)
    .optional()
    .default(DEFAULT_SECURITY_HOLDINGS)
    .describe(`Maximum rows to return (capped at ${MAX_SECURITY_HOLDINGS}).`),
});
type ListSecurityHoldingsInput = z.infer<typeof listSecurityHoldingsInput>;

const LIST_SECURITY_HOLDINGS_QUERY = /* GraphQL */ `
  query McpListSecurityHoldings($includeClosed: Boolean!) {
    securityHoldings(includeClosed: $includeClosed) {
      id
      security {
        ownerId
        isin
        symbol
        engName
        hebName
        exchange
        currencyCode
        isEtf
        identifiers {
          type
          value
        }
      }
      position {
        quantity
        averageCost {
          raw
          formatted
          currency
        }
        totalBought {
          raw
          formatted
          currency
        }
        totalSold {
          raw
          formatted
          currency
        }
        historyStartDate
        lastExecutionDate
      }
    }
  }
`;

type RawHolding = McpListSecurityHoldingsQuery['securityHoldings'][number];

/**
 * Every string the search matches, mirroring the web screen's own search so the
 * two cannot drift: name in both languages, symbol, ISIN, exchange, currency and
 * every source identifier (a Poalim key is how a trade is named in a bank
 * statement, so it is a thing a caller will paste in).
 */
function searchableText(holding: RawHolding): string {
  const { security } = holding;
  return [
    security.engName,
    security.hebName,
    security.symbol,
    security.isin,
    security.exchange,
    security.currencyCode,
    ...security.identifiers.map(identifier => identifier.value),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** A name is never empty: the ISIN is the identity, so it is the last resort. */
function holdingName(holding: RawHolding): string {
  return holding.security.engName ?? holding.security.hebName ?? holding.security.isin;
}

function normalizeHolding(holding: RawHolding) {
  const { security, position } = holding;
  return {
    securityBusinessId: holding.id,
    ownerId: security.ownerId,
    isin: security.isin,
    symbol: security.symbol,
    name: holdingName(holding),
    exchange: security.exchange,
    currency: security.currencyCode,
    isEtf: security.isEtf,
    quantity: position.quantity,
    averageCost: normalizeAmount(position.averageCost),
    totalBought: normalizeAmount(position.totalBought),
    totalSold: normalizeAmount(position.totalSold),
    historyStartDate: position.historyStartDate,
    lastExecutionDate: position.lastExecutionDate,
  };
}
type NormalizedHolding = ReturnType<typeof normalizeHolding>;

const NAME_COLLATOR = new Intl.Collator('en', { sensitivity: 'base' });

/**
 * Biggest live position first — the reason to ask for a portfolio at all, and the
 * web screen's own default.
 *
 * `Math.abs` on purpose: a negative quantity is a history that starts mid-life,
 * which is a large position badly recorded rather than a small one. Ties break
 * on name then id so the order is stable across calls.
 */
function bySizeThenName(a: NormalizedHolding, b: NormalizedHolding): number {
  return (
    Math.abs(b.quantity) - Math.abs(a.quantity) ||
    NAME_COLLATOR.compare(a.name, b.name) ||
    (a.securityBusinessId < b.securityBusinessId
      ? -1
      : a.securityBusinessId > b.securityBusinessId
        ? 1
        : 0)
  );
}

/** Money summed to the cent; a float sum of trade values otherwise trails noise. */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The only aggregation these numbers support: a subtotal per trade currency.
 *
 * Asked what a portfolio is worth, a model will add a shekel column to a dollar
 * one. Computing the sums that *are* valid, and only those, leaves nothing to
 * mis-add — grouping is structural where a caveat is advisory. Quantities and
 * average costs are deliberately absent: units of different instruments and
 * per-unit prices do not add up even within one currency.
 *
 * A security with nothing ingested has no currency to report in, so it is
 * counted separately rather than folded into an arbitrary bucket.
 */
function subtotalsByCurrency(holdings: readonly NormalizedHolding[]) {
  const byCurrency = new Map<string, { securityCount: number; bought: number; sold: number }>();
  let securitiesWithNoCurrency = 0;

  for (const holding of holdings) {
    // Only an actual amount counts. `holding.currency` is the security's static
    // reference currency, which is known even for a security nothing was ever
    // traded of — folding it in here would put that security in a bucket with a
    // 0/0 subtotal, which is exactly the null-vs-zero confusion the caveats warn
    // against.
    const currency =
      holding.totalBought?.currency ?? holding.totalSold?.currency ?? holding.averageCost?.currency;
    if (!currency) {
      securitiesWithNoCurrency += 1;
      continue;
    }
    const bucket = byCurrency.get(currency) ?? { securityCount: 0, bought: 0, sold: 0 };
    bucket.securityCount += 1;
    bucket.bought += holding.totalBought?.value ?? 0;
    bucket.sold += holding.totalSold?.value ?? 0;
    byCurrency.set(currency, bucket);
  }

  return {
    securitiesWithNoCurrency,
    byCurrency: [...byCurrency.entries()]
      .map(([currency, bucket]) => ({
        currency,
        securityCount: bucket.securityCount,
        totalBought: roundMoney(bucket.bought),
        totalSold: roundMoney(bucket.sold),
      }))
      .sort((a, b) => b.securityCount - a.securityCount || a.currency.localeCompare(b.currency)),
  };
}

async function listSecurityHoldingsHandler(
  input: ListSecurityHoldingsInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const data = await context.client.query<McpListSecurityHoldingsQuery>(
    {
      query: LIST_SECURITY_HOLDINGS_QUERY,
      variables: { includeClosed: input.includeClosed },
    },
    context.upstream,
  );

  // Upstream takes no search argument and a portfolio is tens to low hundreds of
  // rows, so filtering here costs nothing and keeps the match rules identical to
  // the web screen's.
  // Trimmed as well as lowercased, matching the web screen's own normalization
  // (`screens/securities/index.tsx`) — a pasted `" NVDA "` has to behave the same
  // in both places for the parity this mirrors to be worth anything.
  const needle = input.search?.trim().toLowerCase();
  const matched = needle
    ? data.securityHoldings.filter(holding => searchableText(holding).includes(needle))
    : data.securityHoldings;

  const holdings = matched.map(normalizeHolding).sort(bySizeThenName);
  // Subtotals cover every match, not just the page: a total that silently shrank
  // with the row cap would be worse than no total.
  const { byCurrency, securitiesWithNoCurrency } = subtotalsByCurrency(holdings);

  return shapeListResult({
    items: holdings.slice(0, input.limit),
    itemsKey: 'holdings',
    total: holdings.length,
    extra: {
      byCurrency,
      securitiesWithNoCurrency,
      caveats: SECURITIES_CAVEATS,
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
    },
    summarize: (shown, total, truncated) =>
      total === 0
        ? 'No securities matched.'
        : `${total} ${total === 1 ? 'security' : 'securities'}${input.includeClosed ? ' (including closed positions)' : ' currently held'}; showing ${shown}${truncated ? ' (truncated)' : ''}. Amounts are per-security trade currency - see byCurrency for the only valid subtotals.`,
  });
}

export const listSecurityHoldingsTool: ToolDefinition<typeof listSecurityHoldingsInput> = {
  name: LIST_SECURITY_HOLDINGS_TOOL_NAME,
  description:
    'List the securities portfolio: one row per security with units held, weighted average cost per unit bought, totals bought and sold, and the dates the ingested trade history spans. ' +
    'Positions are DERIVED by adding up scraped executions, not read from a bank balance, and there are no market prices - so current value and unrealized profit/loss are unavailable. ' +
    "Amounts are in each security's own trade currency and are never converted: use the response's `byCurrency` subtotals rather than adding rows up, and never sum quantities or average costs. " +
    'Every response carries a `caveats` array stating the limits of the derivation. ' +
    'Set `includeClosed` to also see securities traded but no longer held. Use accounter_get_security_executions for the trades behind a row. Read-only. ' +
    resultEnvelopeDescription('holdings') +
    ' ' +
    SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: listSecurityHoldingsInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler: listSecurityHoldingsHandler,
};

// ---------------------------------------------------------------------------
// Executions
// ---------------------------------------------------------------------------

/**
 * The bank's closed vocabularies, mirrored from the upstream enums. Listed rather
 * than free strings so the model is told what it may ask for, and so an unknown
 * value fails as input validation instead of as an empty result.
 */
export const SECURITY_TRADE_TYPES = [
  'BUY',
  'SELL',
  'DIVIDEND_PAYMENT',
  'INTEREST_PAYMENT',
  'REDEMPTION',
  'STOCK_DISTRIBUTION',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'TRANSFER_IN_TWO_SIDED',
  'TRANSFER_OUT_TWO_SIDED',
] as const;

export const SECURITY_TRANSACTION_TYPES = [
  'BUY',
  'SELL',
  'PAYMENTS_AND_CORPORATE_ACTIONS',
  'TRANSFERS',
] as const;

const securityIdList = (what: string) =>
  z.array(z.string().min(1)).min(1).max(MAX_REQUESTED_SECURITIES).optional().describe(what);

const getSecurityExecutionsInput = z.object({
  memberBusinessIds: memberBusinessIdsInput,
  securityBusinessIds: securityIdList(
    'Securities to include, by the `securityBusinessId` accounter_list_security_holdings returns.',
  ),
  isins: securityIdList('Securities to include, by ISIN.'),
  symbols: securityIdList('Securities to include, by ticker symbol (case-insensitive).'),
  fromTradeDate: TIMELESS_DATE.optional().describe('Earliest trade date to include (YYYY-MM-DD).'),
  toTradeDate: TIMELESS_DATE.optional().describe('Latest trade date to include (YYYY-MM-DD).'),
  tradeTypes: z
    .array(z.enum(SECURITY_TRADE_TYPES))
    .min(1)
    .optional()
    .describe(
      'Restrict to these kinds of execution. Note dividends and interest are execution kinds here (DIVIDEND_PAYMENT, INTEREST_PAYMENT), not a separate entity.',
    ),
  transactionTypes: z
    .array(z.enum(SECURITY_TRANSACTION_TYPES))
    .min(1)
    .optional()
    .describe('Restrict to these coarser buckets.'),
  includeCharges: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Also resolve the charge and transaction behind each execution. Requires naming securities (securityBusinessIds, isins or symbols) and is limited to a small number of them, because the pairing has to be computed over each security whole history rather than a page.',
    ),
  page: z
    .number()
    .int()
    .positive()
    .optional()
    .default(1)
    .describe('1-based page number, newest executions first.'),
  pageSize: z
    .number()
    .int()
    .positive()
    .max(MAX_SECURITY_EXECUTIONS_PAGE_SIZE)
    .optional()
    .default(DEFAULT_SECURITY_EXECUTIONS_PAGE_SIZE)
    .describe(`Rows per page (capped at ${MAX_SECURITY_EXECUTIONS_PAGE_SIZE}).`),
});
type GetSecurityExecutionsInput = z.infer<typeof getSecurityExecutionsInput>;

const GET_SECURITY_EXECUTIONS_QUERY = /* GraphQL */ `
  query McpGetSecurityExecutions(
    $filters: SecurityExecutionsFilter
    $page: Int!
    $limit: Int!
    $includeCharges: Boolean!
  ) {
    securityExecutions(
      filters: $filters
      page: $page
      limit: $limit
      includeCharges: $includeCharges
    ) {
      pageInfo {
        totalPages
        totalRecords
      }
      nodes {
        securityBusiness {
          id
          ownerId
          isin
          symbol
        }
        charge @include(if: $includeCharges) {
          id
        }
        transaction @include(if: $includeCharges) {
          id
        }
        execution {
          id
          tradeDate
          valueDate
          tradeType
          transactionType
          paymentType
          quantity
          tradePrice
          netValue {
            raw
            formatted
            currency
          }
          tradeCommission {
            raw
            formatted
            currency
          }
          israelTaxValue {
            raw
            formatted
            currency
          }
        }
      }
    }
  }
`;

type RawExecutionNode = McpGetSecurityExecutionsQuery['securityExecutions']['nodes'][number];

/**
 * Each date is validated on its own even when only one is given: a value can pass
 * the format regex and still not be a calendar date (2026-02-31). No width cap —
 * pagination already bounds the result, and a trade history is meant to be asked
 * about across years.
 */
function assertTradeDateRange(input: GetSecurityExecutionsInput): void {
  let from: number | undefined;
  if (input.fromTradeDate !== undefined) {
    const parsed = parseCalendarDate(input.fromTradeDate);
    if (parsed === null) {
      throw new ToolInputError('Invalid fromTradeDate');
    }
    from = parsed;
  }
  if (input.toTradeDate !== undefined) {
    const parsed = parseCalendarDate(input.toTradeDate);
    if (parsed === null) {
      throw new ToolInputError('Invalid toTradeDate');
    }
    if (from !== undefined && from > parsed) {
      throw new ToolInputError('fromTradeDate must be on or before toTradeDate');
    }
  }
}

/**
 * Refuse an unnamed `includeCharges` here rather than upstream.
 *
 * Upstream caps how many securities it will pair and rejects the rest, but that
 * arrives as an UPSTREAM_ERROR — which reads as a server fault the model should
 * retry, when in fact the call was malformed. Checking first turns it into the
 * VALIDATION_ERROR it is, and says what to add.
 */
function assertChargeLinksAreNarrowed(input: GetSecurityExecutionsInput): void {
  if (!input.includeCharges) {
    return;
  }
  if (!input.securityBusinessIds && !input.isins && !input.symbols) {
    throw new ToolInputError(
      'includeCharges requires naming the securities: pass securityBusinessIds, isins or symbols. Charge links are computed over a security whole history, so they cannot be resolved for the entire portfolio at once.',
    );
  }
}

function normalizeExecutionNode(node: RawExecutionNode) {
  const { execution, securityBusiness } = node;
  return {
    executionId: execution.id,
    securityBusinessId: securityBusiness.id,
    ownerId: securityBusiness.ownerId,
    isin: securityBusiness.isin,
    symbol: securityBusiness.symbol,
    tradeDate: execution.tradeDate,
    valueDate: execution.valueDate,
    tradeType: execution.tradeType,
    transactionType: execution.transactionType,
    paymentType: execution.paymentType,
    quantity: execution.quantity,
    tradePrice: execution.tradePrice,
    netValue: normalizeAmount(execution.netValue),
    tradeCommission: normalizeAmount(execution.tradeCommission),
    israelTaxValue: normalizeAmount(execution.israelTaxValue),
    // Absent rather than null when not asked for, so "no charge matched" stays
    // distinguishable from "charge links were not requested". `@include(if:)`
    // omits the field entirely, which is what makes the distinction possible.
    ...(node.charge === undefined ? {} : { chargeId: node.charge?.id ?? null }),
    ...(node.transaction === undefined ? {} : { transactionId: node.transaction?.id ?? null }),
  };
}

async function getSecurityExecutionsHandler(
  input: GetSecurityExecutionsInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  assertTradeDateRange(input);
  assertChargeLinksAreNarrowed(input);

  const data = await context.client.query<McpGetSecurityExecutionsQuery>(
    {
      query: GET_SECURITY_EXECUTIONS_QUERY,
      variables: {
        filters: {
          securityBusinessIds: input.securityBusinessIds,
          isins: input.isins,
          symbols: input.symbols,
          fromTradeDate: input.fromTradeDate,
          toTradeDate: input.toTradeDate,
          tradeTypes: input.tradeTypes,
          transactionTypes: input.transactionTypes,
        },
        // Upstream pages from zero; the tool's page is 1-based, as everywhere.
        page: input.page - 1,
        limit: input.pageSize,
        includeCharges: input.includeCharges,
      },
    },
    context.upstream,
  );

  const { nodes, pageInfo } = data.securityExecutions;
  const executions = nodes.map(normalizeExecutionNode);
  const pagination = {
    page: input.page,
    pageSize: input.pageSize,
    totalPages: pageInfo.totalPages,
    hasNextPage: input.page < pageInfo.totalPages,
  };

  return shapeListResult({
    items: executions,
    itemsKey: 'executions',
    total: pageInfo.totalRecords,
    extra: {
      pagination,
      caveats: SECURITIES_CAVEATS,
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
    },
    summarize: (shown, total) =>
      total === 0
        ? 'No executions matched the given filters.'
        : `${total} execution(s); showing ${shown} on page ${pagination.page} of ${pagination.totalPages}, newest first. Amounts are in each security own trade currency.`,
  });
}

export const getSecurityExecutionsTool: ToolDefinition<typeof getSecurityExecutionsInput> = {
  name: GET_SECURITY_EXECUTIONS_TOOL_NAME,
  description:
    'Fetch securities trade history - buys, sales, dividends, interest, redemptions and transfers - newest first, with dates, direction, quantity, unit price, net value, commission and Israeli tax. ' +
    'Narrow by security (securityBusinessIds, isins or symbols - these three union with each other, since they are three ways of naming the same thing), by trade date, and by kind. ' +
    "Amounts are in each security's own trade currency and are never converted, so do not add rows from different securities together. " +
    'Set `includeCharges` to also get the charge each trade cash movement landed on; that requires naming the securities, because the pairing is computed over a security whole history rather than a page. ' +
    'If a call fails with an upstream error naming an unknown trade type, the bank has used a label the server does not yet translate - that is a data bug worth reporting, not something to retry; passing explicit `tradeTypes` filters such rows out and works around it. Read-only. ' +
    resultEnvelopeDescription('executions') +
    ' ' +
    SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: getSecurityExecutionsInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler: getSecurityExecutionsHandler,
};
