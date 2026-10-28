import type { Injector } from 'graphql-modules';
import type { SecuritiesTaxCategoryKey } from '../../../__generated__/types.js';
import { Currency, SecurityTradeType } from '../../../shared/enums.js';
import { addDaysToTimelessDate } from '../../../shared/helpers/timeless-date.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import type { AdminContext } from '../../admin-context/types.js';
import { ExchangeRateNotAvailableError } from '../../exchange-rates/helpers/exchange.helper.js';
import { ExchangeProvider } from '../../exchange-rates/providers/exchange.provider.js';
import { TaxCategoriesProvider } from '../../financial-entities/providers/tax-categories.provider.js';
import {
  cancelledTradeType,
  pairCancellations,
} from '../../foreign-securities/helpers/security-cancellations.helper.js';
import {
  getSecurityCapitalGain,
  SecurityCapitalGainError,
} from '../../foreign-securities/helpers/security-capital-gain.helper.js';
import {
  describeSecurity,
  getDisposalProceeds,
  isDisposalExecution,
} from '../../foreign-securities/helpers/security-disposal.helper.js';
import {
  currencyOfSecurityLabel,
  isDividendInKindDistribution,
  tryToSecurityTradeType,
} from '../../foreign-securities/helpers/security-execution-enums.helper.js';
import { getSecurityLocality } from '../../foreign-securities/helpers/security-locality.helper.js';
import { getWithheldTaxParts } from '../../foreign-securities/helpers/security-withheld-tax.helper.js';
import { ForeignSecuritiesProvider } from '../../foreign-securities/providers/foreign-securities.provider.js';
import type { SecurityExecutionRow } from '../../foreign-securities/types.js';
import {
  INCOME_TAX_CATEGORY_KEYS,
  WITHHOLDING_TAX_CATEGORY_KEYS,
} from '../../ledger/helpers/foreign-securities-ledger.helper.js';
import { LedgerProvider } from '../../ledger/providers/ledger.provider.js';
import { PriceIndexNotAvailableError } from '../../price-indexes/helpers/price-index.helper.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import {
  ledgerEntityAmount,
  ledgerRecordRate,
  SEMI_ANNUAL_INCOME_BUCKETS,
  splitIncomeWithholding,
  WITHHOLDING_SPLIT_TOLERANCE,
  type SecuritiesIncomeKind,
  type SecuritiesIncomeLocality,
  type SemiAnnualIncomeFigures,
  type SemiAnnualPeriod,
  type SemiAnnualSaleFigures,
} from './securities-semi-annual-report.helper.js';

/*
 * What the semi-annual securities report reads: the half's sales and redemptions (from the bank's
 * executions, priced from their FIFO lots), and its dividend and interest income (from the ledger,
 * as booked on the securities income tax categories). The arithmetic is in
 * `securities-semi-annual-report.helper.ts`.
 */

/** How late a cancellation may come after the half and still cancel one of its sales */
const CANCELLATION_LOOKAHEAD_DAYS = 10;

/** More income records than this in a half is more than one query fetches */
const INCOME_RECORDS_LIMIT = 10_000;

export type SemiAnnualIssue = {
  message: string;
  executionId?: string | null;
  chargeId?: string | null;
  /** A securities tax category the report needs and the settings lack */
  missingTaxCategory?: SecuritiesTaxCategoryKey | null;
};

/** The securities settings' tax categories the report counts as securities expenses */
export const SECURITIES_EXPENSE_TAX_CATEGORY_KEYS = [
  'FOREIGN_SECURITIES_FEES',
  'FINANCIAL_CONSULTANCY',
] as const satisfies readonly SecuritiesTaxCategoryKey[];

export type SemiAnnualExpense = {
  key: (typeof SECURITIES_EXPENSE_TAX_CATEGORY_KEYS)[number];
  taxCategoryId: string;
  name: string;
  /** What the ledger booked on the category in the half, in ILS: debits less credits */
  amount: number;
};

export type SemiAnnualSale = SemiAnnualSaleFigures & {
  id: string;
  securityBusinessId: string | null;
  tradeDate: TimelessDateString;
  tradeType: SecurityTradeType;
  security: string;
  quantity: number;
  cost: number | null;
  nominalGain: number | null;
  error: string | null;
};

export type SemiAnnualIncomeItem = SemiAnnualIncomeFigures & {
  id: string;
  chargeId: string;
  date: TimelessDateString;
  security: string | null;
  description: string | null;
};

const isRedemption = (execution: Pick<SecurityExecutionRow, 'trade_type'>) =>
  tryToSecurityTradeType(execution.trade_type) === SecurityTradeType.Redemption;

/** The currency an execution's amounts are in: its settlement currency, else its trade currency */
const executionCurrency = (execution: SecurityExecutionRow) =>
  currencyOfSecurityLabel(execution.settlement_currency) ??
  currencyOfSecurityLabel(execution.trade_currency);

async function rateOn(
  injector: Injector,
  currency: Currency,
  localCurrency: Currency,
  date: TimelessDateString,
): Promise<number | null> {
  if (currency === localCurrency) {
    return 1;
  }
  try {
    return await injector.get(ExchangeProvider).getExchangeRates(currency, localCurrency, date);
  } catch (error) {
    if (error instanceof ExchangeRateNotAvailableError) {
      return null;
    }
    throw error;
  }
}

/**
 * Whether an error is about the data the user can fix — a missing rate, CPI or purchase — rather
 * than a failure to read it. Only those make a sale an issue; anything else fails the report rather
 * than quietly leaving the sale's gain out of it.
 */
const isDataError = (error: unknown): error is Error =>
  error instanceof SecurityCapitalGainError ||
  error instanceof PriceIndexNotAvailableError ||
  error instanceof ExchangeRateNotAvailableError;

/**
 * The half's sales and redemptions, each priced from its FIFO lots by `getSecurityCapitalGain`.
 *
 * A cancelled sale is dropped with its cancellation; cancellations are looked for a few days past
 * the half, so a sale cancelled just after it still drops. Buys are read too, because the bank may
 * report a cancellation as the opposite trade (`cancelledTradeType`): a cancelled buy then reads as
 * a sale, and is dropped with its buy rather than flagged. A sale whose gain cannot be worked out
 * still counts in the turnover, at its proceeds and the trade date's rate — or the bank's own
 * shekel value — and is reported as an issue.
 */
export async function collectHalfDisposals(
  injector: Injector,
  params: { ownerId: string; period: SemiAnnualPeriod; localCurrency: Currency },
): Promise<{ sales: SemiAnnualSale[]; issues: SemiAnnualIssue[] }> {
  const { ownerId, period, localCurrency } = params;
  const issues: SemiAnnualIssue[] = [];

  const rows = await injector.get(ForeignSecuritiesProvider).getOwnerExecutionsByTradeDates({
    ownerId,
    fromDate: period.fromDate,
    toDate: addDaysToTimelessDate(period.toDate, CANCELLATION_LOOKAHEAD_DAYS),
    tradeTypes: [SecurityTradeType.Buy, SecurityTradeType.Sell, SecurityTradeType.Redemption],
  });
  const inPeriod = (execution: SecurityExecutionRow) => execution.trade_date <= period.toDate;
  const { live, orphanCancellations } = pairCancellations(rows);

  for (const cancellation of orphanCancellations.filter(inPeriod)) {
    // a cancelled buy from an earlier half is no sale of this one
    const cancelled = { trade_type: cancelledTradeType(cancellation) };
    if (!isDisposalExecution(cancelled)) {
      continue;
    }
    issues.push({
      message: `A cancellation of ${describeSecurity(cancellation)} on ${cancellation.trade_date} matches no ${isRedemption(cancelled) ? 'redemption' : 'sale'} in the half, so it is left out — check whether what it cancels belongs to an earlier half`,
      executionId: cancellation.id,
    });
  }

  // the buys were read only to pair cancellations
  const disposals = live.filter(row => inPeriod(row) && isDisposalExecution(row));
  const sales = await Promise.all(
    disposals.map(async (row): Promise<SemiAnnualSale> => {
      const security = describeSecurity(row);
      const base = {
        id: row.id,
        securityBusinessId: row.security_business_id,
        tradeDate: row.trade_date,
        tradeType: isRedemption(row) ? SecurityTradeType.Redemption : SecurityTradeType.Sell,
        security,
        quantity: Math.abs(Number(row.nv) || 0),
      };
      const withheld = getWithheldTaxParts(row);
      if (withheld.foreign !== 0) {
        issues.push({
          message: `Foreign tax of ${withheld.foreign} was withheld on the disposal of ${security} on ${row.trade_date}; it is not credited by this report`,
          executionId: row.id,
        });
      }

      try {
        const gain = await getSecurityCapitalGain(injector, row);
        if (gain) {
          return {
            ...base,
            consideration: gain.proceeds * gain.saleRate,
            cost: gain.lots.reduce((total, lot) => total + lot.costLocal, 0),
            nominalGain: gain.nominalGain,
            inflationaryAmount: gain.inflationaryAmount,
            realGain: gain.realGain,
            israeliTaxWithheld: withheld.israeli * gain.saleRate,
            error: null,
          };
        }
      } catch (error) {
        if (!isDataError(error)) {
          throw error;
        }
        const message =
          error instanceof ExchangeRateNotAvailableError
            ? `Could not work out the capital gain of ${security} on ${row.trade_date}: ${error.message}`
            : error.message;
        issues.push({
          message: `${message}. Its consideration is counted in the turnover, but not its gain or loss`,
          executionId: row.id,
        });
        return {
          ...base,
          ...(await fallbackFigures(injector, row, localCurrency, issues)),
          error: message,
        };
      }

      const message = `The disposal of ${security} on ${row.trade_date} has no capital gain to work out`;
      issues.push({ message, executionId: row.id });
      return {
        ...base,
        ...(await fallbackFigures(injector, row, localCurrency, issues)),
        error: message,
      };
    }),
  );

  return { sales, issues };
}

/** A disposal's consideration and withheld tax when its gain cannot be worked out */
async function fallbackFigures(
  injector: Injector,
  row: SecurityExecutionRow,
  localCurrency: Currency,
  issues: SemiAnnualIssue[],
): Promise<
  Omit<SemiAnnualSaleFigures, 'realGain'> & {
    realGain: null;
    cost: null;
    nominalGain: null;
  }
> {
  const empty = { cost: null, nominalGain: null, realGain: null, inflationaryAmount: 0 } as const;
  const currency = executionCurrency(row);
  const rate = currency ? await rateOn(injector, currency, localCurrency, row.trade_date) : null;
  const proceeds = currency ? getDisposalProceeds(row, currency) : null;
  const israeliTaxWithheld = rate == null ? 0 : getWithheldTaxParts(row).israeli * rate;

  if (proceeds != null && rate != null) {
    return { ...empty, consideration: proceeds * rate, israeliTaxWithheld };
  }
  const bankShekels = Math.abs(Number(row.trade_gross_value_nis) || 0);
  if (localCurrency === Currency.Ils && bankShekels > 0) {
    if (rate == null && getWithheldTaxParts(row).israeli !== 0) {
      issues.push({
        message: `The Israeli tax withheld on ${describeSecurity(row)} on ${row.trade_date} could not be converted to ${localCurrency}, so it is not credited`,
        executionId: row.id,
      });
    }
    return { ...empty, consideration: bankShekels, israeliTaxWithheld };
  }
  issues.push({
    message: `The consideration of ${describeSecurity(row)} on ${row.trade_date} could not be worked out, so the turnover leaves it out`,
    executionId: row.id,
  });
  return { ...empty, consideration: 0, israeliTaxWithheld };
}

type IncomeBucketCategories = {
  kind: SecuritiesIncomeKind;
  locality: SecuritiesIncomeLocality;
  incomeId: string;
  withholdingId: string | null;
};

const INCOME_KIND_LABEL: Record<SecuritiesIncomeKind, string> = {
  DIVIDEND: 'dividend',
  INTEREST: 'interest',
};

/**
 * The half's dividend and interest income, record by record, as the ledger books it on the
 * securities income tax categories (by `invoice_date`, the day the cash came in).
 *
 * The ledger books the foreign and the Israeli tax withheld on one line, so each record is traced
 * to the execution behind it — through its transaction (`reference1` is the transaction's origin
 * key), or for a dividend in kind, through the charge — and the line is split by what the
 * execution reports. Withholding is only read off income records: the bond withholding category is
 * shared with redemptions, whose tax the sales already count.
 */
export async function collectHalfSecuritiesIncome(
  injector: Injector,
  params: { ownerId: string; period: SemiAnnualPeriod; adminContext: AdminContext },
): Promise<{ income: SemiAnnualIncomeItem[]; issues: SemiAnnualIssue[] }> {
  const { ownerId, period, adminContext } = params;
  const { taxCategories } = adminContext.foreignSecurities;
  const issues: SemiAnnualIssue[] = [];

  const buckets: IncomeBucketCategories[] = [];
  const unconfigured = new Set<`${SecuritiesIncomeKind}:${SecuritiesIncomeLocality}`>();
  for (const { kind, locality } of SEMI_ANNUAL_INCOME_BUCKETS) {
    const incomeId = taxCategories[INCOME_TAX_CATEGORY_KEYS[kind][locality]];
    if (!incomeId) {
      unconfigured.add(`${kind}:${locality}`);
      continue;
    }
    buckets.push({
      kind,
      locality,
      incomeId,
      withholdingId: taxCategories[WITHHOLDING_TAX_CATEGORY_KEYS[kind][locality]] ?? null,
    });
  }

  const securities = injector.get(ForeignSecuritiesProvider);
  const [records, incomeExecutions] = await Promise.all([
    buckets.length === 0
      ? Promise.resolve([])
      : injector.get(LedgerProvider).getLedgerRecordsByFilters({
          financialEntityIds: buckets.map(bucket => bucket.incomeId),
          ownerIds: [ownerId],
          fromInvoiceDate: period.fromDate,
          toInvoiceDate: period.toDate,
          limit: INCOME_RECORDS_LIMIT,
        }),
    securities.getOwnerExecutionsByTradeDates({
      ownerId,
      fromDate: period.fromDate,
      toDate: period.toDate,
      // a dividend in kind is income too; other stock distributions (bonus issues, splits) aren't
      tradeTypes: [
        SecurityTradeType.DividendPayment,
        SecurityTradeType.InterestPayment,
        SecurityTradeType.StockDistribution,
      ],
    }),
  ]);
  if (records.length >= INCOME_RECORDS_LIMIT) {
    issues.push({
      message: `The half has more than ${INCOME_RECORDS_LIMIT} dividend and interest ledger records; only the first ${INCOME_RECORDS_LIMIT} are counted`,
    });
  }

  // traced all at once: the transactions load batches across records; the executions are one query
  // per charge
  const executions = await Promise.all(
    records.map(record => findRecordExecution(injector, record, ownerId)),
  );
  const tracedExecutionIds = new Set<string>();
  const income: SemiAnnualIncomeItem[] = [];
  for (const [index, record] of records.entries()) {
    const bucket = buckets.find(candidate => ledgerEntityAmount(record, candidate.incomeId) !== 0);
    if (!bucket) {
      continue;
    }
    const gross = ledgerEntityAmount(record, bucket.incomeId);
    const withheld = bucket.withholdingId ? -ledgerEntityAmount(record, bucket.withholdingId) : 0;
    const execution = executions[index];
    if (execution) {
      tracedExecutionIds.add(execution.id);
    }

    const split = splitIncomeWithholding({
      locality: bucket.locality,
      withheld,
      parts: execution ? getWithheldTaxParts(execution) : null,
      rate: ledgerRecordRate(record, bucket.incomeId),
    });
    const label = `${INCOME_KIND_LABEL[bucket.kind]} booked on ${record.invoice_date}`;
    if (!split.matched && withheld !== 0) {
      issues.push({
        message: `The tax withheld on the ${label} could not be traced to its execution, so it is taken as ${bucket.locality === 'LOCAL' ? 'Israeli' : 'foreign'} tax`,
        chargeId: record.charge_id,
      });
    } else if (Math.abs(split.mismatch) > WITHHOLDING_SPLIT_TOLERANCE) {
      issues.push({
        message: `The tax withheld on the ${label} (${withheld.toFixed(2)}) does not match its execution's (${(withheld + split.mismatch).toFixed(2)}); the ledger's amount is split by the execution's foreign and Israeli shares`,
        chargeId: record.charge_id,
        executionId: execution?.id,
      });
    }
    if (bucket.locality === 'LOCAL' && bucket.kind === 'DIVIDEND' && split.foreign !== 0) {
      issues.push({
        message: `Foreign tax was withheld on the local ${label}; local dividends are exempt, so it is not credited`,
        chargeId: record.charge_id,
      });
    }

    income.push({
      id: record.id,
      kind: bucket.kind,
      locality: bucket.locality,
      chargeId: record.charge_id,
      date: record.invoice_date,
      security: execution ? describeSecurity(execution) : null,
      description: record.description,
      gross,
      foreignTaxWithheld: split.foreign,
      israeliTaxWithheld: split.israeli,
    });
  }

  // income the bank paid in the half that no ledger record books
  const { live } = pairCancellations(incomeExecutions);
  for (const execution of live) {
    if (
      tracedExecutionIds.has(execution.id) ||
      (tryToSecurityTradeType(execution.trade_type) === SecurityTradeType.StockDistribution &&
        !isDividendInKindDistribution(execution))
    ) {
      continue;
    }
    const kind: SecuritiesIncomeKind =
      tryToSecurityTradeType(execution.trade_type) === SecurityTradeType.InterestPayment
        ? 'INTEREST'
        : 'DIVIDEND';
    const security = describeSecurity(execution);
    const locality = getSecurityLocality(execution, adminContext.locality);
    // with the locality unknown, a kind with any bucket unset may be why
    const categoryUnset = locality
      ? unconfigured.has(`${kind}:${locality}`)
      : unconfigured.has(`${kind}:LOCAL`) || unconfigured.has(`${kind}:FOREIGN`);
    issues.push({
      message: categoryUnset
        ? `The ${INCOME_KIND_LABEL[kind]} of ${security} on ${execution.trade_date} is left out: its income tax category is not set in the securities settings`
        : `No ledger record in the half books the ${INCOME_KIND_LABEL[kind]} of ${security} paid on ${execution.trade_date} — its charge's ledger may not be generated, or its cash came in after the half`,
      executionId: execution.id,
    });
  }

  return { income, issues };
}

const EXPENSE_LABEL: Record<SemiAnnualExpense['key'], string> = {
  FOREIGN_SECURITIES_FEES: 'Foreign securities fees',
  FINANCIAL_CONSULTANCY: 'Financial consultancy',
};

/**
 * The half's securities expenses: what the ledger booked (by `invoice_date`) on the tax categories
 * the securities settings name as the fees (where the securities ledger books commissions) and the
 * financial consultancy. They come from the settings rather than a sort code, so a category is in
 * because it plays that role, not because of where it is filed.
 */
export async function collectHalfSecuritiesExpenses(
  injector: Injector,
  params: { ownerId: string; period: SemiAnnualPeriod; adminContext: AdminContext },
): Promise<{ expenses: SemiAnnualExpense[]; issues: SemiAnnualIssue[] }> {
  const { ownerId, period, adminContext } = params;
  const { taxCategories } = adminContext.foreignSecurities;
  const issues: SemiAnnualIssue[] = [];

  const categories: { key: SemiAnnualExpense['key']; taxCategoryId: string }[] = [];
  for (const key of SECURITIES_EXPENSE_TAX_CATEGORY_KEYS) {
    const taxCategoryId = taxCategories[key];
    const sharing = categories.find(category => category.taxCategoryId === taxCategoryId);
    if (sharing) {
      // the settings accept one category in two slots; its records are counted once
      issues.push({
        message: `"${EXPENSE_LABEL[key]}" uses the same tax category as "${EXPENSE_LABEL[sharing.key]}" in the securities settings; it is counted once`,
      });
    } else if (taxCategoryId) {
      categories.push({ key, taxCategoryId });
    } else {
      issues.push({
        message: `No "${EXPENSE_LABEL[key]}" tax category is set in the securities settings, so the securities expenses leave it out`,
        missingTaxCategory: key,
      });
    }
  }
  if (categories.length === 0) {
    return { expenses: [], issues };
  }

  const taxCategoryIds = categories.map(category => category.taxCategoryId);
  const [records, names] = await Promise.all([
    injector.get(LedgerProvider).getLedgerRecordsByFilters({
      financialEntityIds: taxCategoryIds,
      ownerIds: [ownerId],
      fromInvoiceDate: period.fromDate,
      toInvoiceDate: period.toDate,
      limit: INCOME_RECORDS_LIMIT,
    }),
    injector.get(TaxCategoriesProvider).taxCategoryByIdLoader.loadMany(taxCategoryIds),
  ]);
  if (records.length >= INCOME_RECORDS_LIMIT) {
    issues.push({
      message: `The half has more than ${INCOME_RECORDS_LIMIT} securities expense ledger records; only the first ${INCOME_RECORDS_LIMIT} are counted`,
    });
  }

  const expenses = categories.map(({ key, taxCategoryId }, index) => {
    const taxCategory = names[index];
    return {
      key,
      taxCategoryId,
      name: taxCategory && !(taxCategory instanceof Error) ? taxCategory.name : EXPENSE_LABEL[key],
      // an expense is debited: credits less debits comes out negative
      amount: -records.reduce(
        (total, record) => total + ledgerEntityAmount(record, taxCategoryId),
        0,
      ),
    };
  });
  return { expenses, issues };
}

/** The execution behind an income ledger record, or null when it cannot be traced */
async function findRecordExecution(
  injector: Injector,
  record: { charge_id: string; reference1: string | null },
  ownerId: string,
): Promise<SecurityExecutionRow | null> {
  const securities = injector.get(ForeignSecuritiesProvider);
  if (record.reference1) {
    const transactions = await injector
      .get(TransactionsProvider)
      .transactionsByChargeIDLoader.load(record.charge_id);
    const transaction = transactions.find(candidate => candidate.origin_key === record.reference1);
    if (transaction) {
      const executions = await securities.getChargeExecutionsByTransactionId(
        record.charge_id,
        ownerId,
      );
      const execution = executions.get(transaction.id);
      if (execution) {
        return execution;
      }
    }
  }
  // a dividend in kind has no cash leg: its charge names its execution
  const distributions = (await securities.executionsByChargeIdLoader.load(record.charge_id)).filter(
    isDividendInKindDistribution,
  );
  return distributions.length === 1 ? distributions[0] : null;
}
