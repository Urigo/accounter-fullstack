import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import type {
  Maybe,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
  SecuritiesTaxCategoryKey,
} from '../../../../__generated__/types.js';
import type { Currency } from '../../../../shared/enums.js';
import { formatStringifyAmount } from '../../../../shared/helpers/amount.js';
import type { LedgerProto, StrictLedgerProto } from '../../../../shared/types/index.js';
import {
  securitiesTaxCategoryLabel,
  type SecuritiesTaxCategoryIds,
} from '../../../admin-context/helpers/securities-context.helper.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { getChargeBusinesses } from '../../../charges/helpers/common.helper.js';
import { ExchangeProvider } from '../../../exchange-rates/providers/exchange.provider.js';
import { FinancialAccountsProvider } from '../../../financial-accounts/providers/financial-accounts.provider.js';
import {
  calculateFifoCostBasis,
  type FifoCostBasis,
} from '../../../foreign-securities/helpers/security-cost-basis.helper.js';
import {
  calculateDisposalPnL,
  carryingRateDate,
  compareWithBankProfitLoss,
  costBasisProblem,
  describeSecurity,
  getExecutionBankRate,
  type BankProfitLossMismatch,
} from '../../../foreign-securities/helpers/security-disposal.helper.js';
import { isCancelledExecution } from '../../../foreign-securities/helpers/security-execution-enums.helper.js';
import {
  getSecurityLocality,
  type SecurityLocality,
} from '../../../foreign-securities/helpers/security-locality.helper.js';
import { ForeignSecuritiesProvider } from '../../../foreign-securities/providers/foreign-securities.provider.js';
import type { SecurityExecutionRow } from '../../../foreign-securities/types.js';
import { TransactionsProvider } from '../../../transactions/providers/transactions.provider.js';
import type { IGetTransactionsByChargeIdsResult } from '../../../transactions/types.js';
import { ledgerEntryFromMainTransaction } from '../../helpers/common-charge-ledger.helper.js';
import { splitFeeTransactions } from '../../helpers/fee-transactions.js';
import {
  buildDisposalEntry,
  buildDistributionEntry,
  buildIncomeEntry,
  buildSaleRevaluationEntry,
  calculateDisposalGain,
  classifySecurityExecution,
  currencyOfLabel,
  distributionValueDate,
  findDistributionCancellation,
  getBankRateMismatch,
  getDistributionWithheldTax,
  getWithheldTax,
  INCOME_TAX_CATEGORY_KEYS,
  isDividendInKindDistribution,
  toAmount,
  validateSecurityCommissions,
  WITHHOLDING_TAX_CATEGORY_KEYS,
} from '../../helpers/foreign-securities-ledger.helper.js';
import { storeInitialGeneratedRecords } from '../../helpers/ledgrer-storage.helper.js';
import { generateMiscExpensesLedger } from '../../helpers/misc-expenses-ledger.helper.js';
import {
  getFinancialAccountTaxCategoryId,
  getLedgerBalanceInfo,
  LedgerError,
  ledgerProtoToRecordsConverter,
  updateLedgerBalanceByEntry,
  validateTransactionBasicVariables,
} from '../../helpers/utils.helper.js';

/** Below this, an amount is float noise rather than something to book */
const MIN_AMOUNT = 0.005;

/**
 * The account number of the tenant's foreign-securities account: what the securities side of
 * every cash movement is booked to, through its tax category in the movement's currency.
 */
const FOREIGN_SECURITIES_ACCOUNT_NUMBER = 'foreign_securities';

/** How a ledger error names a cash movement, so the user can find it in the charge */
function describeTransaction(transaction: IGetTransactionsByChargeIdsResult): string {
  const date = transaction.debit_date_override ?? transaction.debit_date ?? transaction.event_date;
  return `"${transaction.source_description ?? transaction.id}" (${date}, ${transaction.amount} ${transaction.currency})`;
}

/**
 * The tax categories an entry needs, or null after recording the missing ones — those are the
 * tenant's to configure, so the charge's error panel offers to pick or create them.
 */
function requireTaxCategories<TKey extends SecuritiesTaxCategoryKey>(
  keys: readonly TKey[],
  taxCategories: SecuritiesTaxCategoryIds,
  errors: Set<string>,
  missingTaxCategories: Set<SecuritiesTaxCategoryKey>,
): Record<TKey, string> | null {
  const missing = keys.filter(key => !taxCategories[key]);
  if (missing.length) {
    for (const key of missing) {
      missingTaxCategories.add(key);
      errors.add(
        `Missing securities tax category "${securitiesTaxCategoryLabel(key)}" — set it from the charge's ledger errors to book securities income, sales and redemptions`,
      );
    }
    return null;
  }
  return Object.fromEntries(keys.map(key => [key, taxCategories[key]])) as Record<TKey, string>;
}

/** The bank's commission on an execution, in shekels — what the bank may deduct from its PnL */
function commissionLocal(execution: SecurityExecutionRow): number {
  return Math.abs(toAmount(execution.trade_commission_value_nis));
}

/**
 * How the bank's own PnL report of a disposal disagrees with its FIFO lots, both at the bank's
 * own rates — so a difference points at the lots (or the bank's figures), not at a rate. Nothing
 * is checked when the bank reports no rate for the disposal or one of its lots.
 */
function bankProfitLossProblems(params: {
  execution: SecurityExecutionRow;
  history: readonly SecurityExecutionRow[];
  costBasis: FifoCostBasis;
  proceedsForeign: number;
  isForeign: boolean;
}): string[] {
  const { execution, costBasis, isForeign } = params;
  const historyById = new Map(params.history.map(row => [row.id, row]));
  const bankRate = (row: SecurityExecutionRow | undefined) =>
    isForeign ? (row ? getExecutionBankRate(row)?.rate : undefined) : 1;

  const saleRate = bankRate(execution);
  const lotRates = costBasis.lots.map(lot => bankRate(historyById.get(lot.executionId)));
  if (saleRate == null || lotRates.some(rate => rate == null)) {
    return [];
  }

  const pnl = calculateDisposalPnL({
    proceedsForeign: params.proceedsForeign,
    saleRate,
    lots: costBasis.lots.map((lot, index) => ({ ...lot, rate: lotRates[index]! })),
  });
  const lotsCommission = costBasis.lots.reduce((sum, lot) => {
    const acquisition = historyById.get(lot.executionId);
    const units = Number(acquisition?.nv);
    return acquisition && units > 0
      ? sum + (commissionLocal(acquisition) * lot.units) / units
      : sum;
  }, 0);
  const mismatches = compareWithBankProfitLoss({
    execution,
    pnl,
    commissionsLocal: commissionLocal(execution) + lotsCommission,
    isForeign,
  });
  if (!mismatches.length) {
    return [];
  }

  const disposal = `the ${classifySecurityExecution(execution) === 'SALE' ? 'sale' : 'redemption'} of ${describeSecurity(execution)} on ${execution.trade_date}`;
  const lots = costBasis.lots
    .map(
      (lot, index) =>
        `${lot.units} bought on ${lot.tradeDate} for ${formatStringifyAmount(lot.costForeign)} at ${lotRates[index]}`,
    )
    .join('; ');
  const describe = ({ field, ours, bank }: BankProfitLossMismatch) => {
    switch (field) {
      case 'NOMINAL':
        return `a nominal profit/loss of ${formatStringifyAmount(bank)} ₪, where its FIFO lots come to ${formatStringifyAmount(ours)} ₪`;
      case 'RATE':
        return `linkage of ${formatStringifyAmount(-bank)} ₪ (an exchange-rate profit/loss of ${formatStringifyAmount(bank)} ₪), where its FIFO lots come to ${formatStringifyAmount(ours)} ₪`;
      case 'REAL':
        return `a real profit/loss of ${formatStringifyAmount(bank)} ₪, where its FIFO lots come to ${formatStringifyAmount(ours)} ₪ (the lower of the price and nominal profit/loss)`;
    }
  };
  return mismatches.map(
    mismatch =>
      `The bank reports ${describe(mismatch)} on ${disposal}, at the bank's own rates (sold at ${saleRate}; lots: ${lots}). It is booked from the lots.`,
  );
}

/**
 * The entries of a disposal — a sale or a redemption — from the FIFO lots it draws on: the
 * disposal entry (cost out, price PnL, withheld tax) and, for a foreign-currency one, the sale
 * revaluation entry (rate PnL). Throws a `LedgerError` for anything that prevents that.
 */
async function disposalLedgerEntries(params: {
  injector: Injector;
  ownerId: string;
  defaultLocalCurrency: Currency;
  kind: 'SALE' | 'REDEMPTION';
  execution: SecurityExecutionRow;
  baseEntry: StrictLedgerProto;
  withheldTax: number;
  requireLocality: () => SecurityLocality;
  taxCategories: SecuritiesTaxCategoryIds;
  errors: Set<string>;
  missingTaxCategories: Set<SecuritiesTaxCategoryKey>;
}): Promise<StrictLedgerProto[]> {
  const { injector, ownerId, defaultLocalCurrency, kind, execution, baseEntry, withheldTax } =
    params;
  const cashCurrency = baseEntry.currency;
  const isForeign = cashCurrency !== defaultLocalCurrency;
  const hasWithheldTax = Math.abs(withheldTax) >= MIN_AMOUNT;

  if (kind === 'SALE' && hasWithheldTax) {
    throw new LedgerError(
      `The bank reports ${withheldTax} ${cashCurrency} tax withheld on the sale of ${describeSecurity(execution)} on ${execution.trade_date}, and booking tax withheld on a sale is not supported yet`,
    );
  }
  // only withheld tax depends on locality, so a redemption without it books as is even when the
  // execution has no issuer country or ISIN
  const withholdingKeys = hasWithheldTax
    ? [WITHHOLDING_TAX_CATEGORY_KEYS.REDEMPTION[params.requireLocality()]]
    : [];

  const history = await injector
    .get(ForeignSecuritiesProvider)
    .getSecurityOwnerHistory(execution, ownerId);
  const costBasis = calculateFifoCostBasis(history, execution, cashCurrency);
  const problem = costBasisProblem(execution, costBasis);
  if (problem) {
    throw new LedgerError(problem);
  }

  // The cost leaves the securities account at the rate it carries each lot at: the rate the lot was
  // booked at, or the one the last year-end revaluation moved it to.
  const saleRate = isForeign
    ? baseEntry.localCurrencyDebitAmount1 / (baseEntry.debitAmount1 ?? 1)
    : 1;
  const carryingRates = await Promise.all(
    costBasis.lots.map(lot =>
      isForeign
        ? injector
            .get(ExchangeProvider)
            .getExchangeRates(
              cashCurrency,
              defaultLocalCurrency,
              carryingRateDate(lot.bookedDate, baseEntry.valueDate),
            )
        : 1,
    ),
  );
  const proceedsForeign =
    (baseEntry.debitAmount1 ?? baseEntry.localCurrencyDebitAmount1) + withheldTax;
  const { ratePnL } = calculateDisposalPnL({
    proceedsForeign,
    saleRate,
    lots: costBasis.lots.map((lot, index) => ({ ...lot, rate: carryingRates[index]! })),
  });

  const gain = calculateDisposalGain(baseEntry, {
    costForeign: costBasis.costForeign,
    withheldTax,
  });
  const gainOrLossKeys: SecuritiesTaxCategoryKey[] =
    gain >= MIN_AMOUNT
      ? ['FOREIGN_SECURITIES_SALE_GAIN']
      : gain <= -MIN_AMOUNT
        ? ['FOREIGN_SECURITIES_SALE_LOSS']
        : [];
  const exchangeKeys: SecuritiesTaxCategoryKey[] =
    ratePnL >= MIN_AMOUNT
      ? ['FOREIGN_SECURITIES_SALE_EXCHANGE_GAIN']
      : ratePnL <= -MIN_AMOUNT
        ? ['FOREIGN_SECURITIES_SALE_EXCHANGE_LOSS']
        : [];
  const ids = requireTaxCategories(
    [...gainOrLossKeys, ...exchangeKeys, ...withholdingKeys],
    params.taxCategories,
    params.errors,
    params.missingTaxCategories,
  );
  if (!ids) {
    return [baseEntry];
  }

  const disposalEntry = buildDisposalEntry(baseEntry, {
    costForeign: costBasis.costForeign,
    withheldTax,
    gainTaxCategoryId: params.taxCategories.FOREIGN_SECURITIES_SALE_GAIN,
    lossTaxCategoryId: params.taxCategories.FOREIGN_SECURITIES_SALE_LOSS,
    withholdingTaxCategoryId: withholdingKeys.length ? ids[withholdingKeys[0]] : undefined,
  });
  const revaluationEntry = buildSaleRevaluationEntry(disposalEntry, {
    ratePnL,
    exchangeGainTaxCategoryId: params.taxCategories.FOREIGN_SECURITIES_SALE_EXCHANGE_GAIN,
    exchangeLossTaxCategoryId: params.taxCategories.FOREIGN_SECURITIES_SALE_EXCHANGE_LOSS,
    localCurrency: defaultLocalCurrency,
    description: `${kind === 'SALE' ? 'Sale' : 'Redemption'} revaluation: ${costBasis.redeemedUnits} × ${describeSecurity(execution)}`,
  });

  for (const problem of bankProfitLossProblems({
    execution,
    history,
    costBasis,
    proceedsForeign,
    isForeign,
  })) {
    params.errors.add(problem);
  }

  return revaluationEntry ? [disposalEntry, revaluationEntry] : [disposalEntry];
}

/**
 * The entries for one cash movement: the base entry (bank ↔ securities account), reshaped by the
 * execution behind it for dividends, bond interest, sales and redemptions — a disposal adds a
 * second entry for its rate PnL. Anything that prevents that is recorded as a ledger error and
 * leaves the base entry as it is.
 */
async function securitiesLedgerEntries(params: {
  injector: Injector;
  ownerId: string;
  locality: string;
  defaultLocalCurrency: Currency;
  transaction: IGetTransactionsByChargeIdsResult;
  baseEntry: StrictLedgerProto;
  execution: SecurityExecutionRow | undefined;
  taxCategories: SecuritiesTaxCategoryIds;
  errors: Set<string>;
  missingTaxCategories: Set<SecuritiesTaxCategoryKey>;
}): Promise<StrictLedgerProto[]> {
  const { locality, transaction, baseEntry, execution, taxCategories, errors } = params;
  const transactionDescription = describeTransaction(transaction);

  if (!execution) {
    errors.add(
      `Transaction ${transactionDescription} has no matched security execution — make sure the securities transactions of its account were scraped for that day`,
    );
    return [baseEntry];
  }

  const kind = classifySecurityExecution(execution);
  if (kind === 'OTHER') {
    return [baseEntry];
  }

  // A cancellation keeps the original's trade type but sends the cash back the other way, so the
  // entries below — built for money coming in — do not fit it.
  if (isCancelledExecution(execution)) {
    errors.add(
      `Transaction ${transactionDescription} reverses a cancelled ${kind.toLowerCase()} of ${describeSecurity(execution)}, and booking the reversal is not supported yet`,
    );
    return [baseEntry];
  }

  try {
    const cashCurrency = baseEntry.currency;
    const tax = getWithheldTax(execution, cashCurrency);
    if (!tax.isConsistent) {
      errors.add(
        `Withheld tax of ${tax.withheld} ${cashCurrency} reported for transaction ${transactionDescription} does not match gross minus net (${tax.deduced} ${cashCurrency})`,
      );
    }
    const hasWithheldTax = Math.abs(tax.withheld) >= MIN_AMOUNT;
    const requireLocality = (): SecurityLocality => {
      const securityLocality = getSecurityLocality(execution, locality);
      if (!securityLocality) {
        throw new LedgerError(
          `Cannot tell whether ${describeSecurity(execution)} of transaction ${transactionDescription} is local or foreign: its execution has no issuer country or ISIN`,
        );
      }
      return securityLocality;
    };

    if (kind === 'DIVIDEND' || kind === 'INTEREST') {
      const securityLocality = requireLocality();
      const incomeKey = INCOME_TAX_CATEGORY_KEYS[kind][securityLocality];
      const withholdingKey = hasWithheldTax
        ? WITHHOLDING_TAX_CATEGORY_KEYS[kind][securityLocality]
        : undefined;
      const ids = requireTaxCategories(
        withholdingKey ? [incomeKey, withholdingKey] : [incomeKey],
        taxCategories,
        errors,
        params.missingTaxCategories,
      );
      if (!ids) {
        return [baseEntry];
      }
      return [
        buildIncomeEntry(baseEntry, {
          incomeTaxCategoryId: ids[incomeKey],
          withholdingTaxCategoryId: withholdingKey ? ids[withholdingKey] : undefined,
          withheldTax: tax.withheld,
        }),
      ];
    }

    return await disposalLedgerEntries({
      injector: params.injector,
      ownerId: params.ownerId,
      defaultLocalCurrency: params.defaultLocalCurrency,
      kind,
      execution,
      baseEntry,
      withheldTax: tax.withheld,
      requireLocality,
      taxCategories,
      errors,
      missingTaxCategories: params.missingTaxCategories,
    });
  } catch (e) {
    errors.add(
      e instanceof LedgerError
        ? e.message
        : `Failed to book the security execution of transaction ${transactionDescription}: ${(e as Error)?.message ?? e}`,
    );
    return [baseEntry];
  }
}

/**
 * The entry for an execution the charge books directly (see `charges_securities_executions`):
 * so far only a stock distribution paid as a dividend in kind, booked as dividend income at the
 * value of the shares received. Null after recording why it cannot be booked.
 */
async function distributionLedgerEntry(params: {
  injector: Injector;
  ownerId: string;
  chargeId: string;
  locality: string;
  defaultLocalCurrency: Currency;
  execution: SecurityExecutionRow;
  /** The owner's foreign-securities account */
  securitiesAccountId: string;
  /** The executions of the distribution's security in its account, shared across distributions */
  getHistory: (execution: SecurityExecutionRow) => Promise<SecurityExecutionRow[]>;
  taxCategories: SecuritiesTaxCategoryIds;
  errors: Set<string>;
  missingTaxCategories: Set<SecuritiesTaxCategoryKey>;
}): Promise<StrictLedgerProto | null> {
  const { injector, ownerId, execution, errors } = params;
  const distribution = `the stock distribution of ${describeSecurity(execution)} on ${execution.trade_date}`;

  if (!isDividendInKindDistribution(execution)) {
    // Bonus issues and splits are not income — they move the cost of the existing holding — and
    // none has been seen yet; they are to be handled when one is.
    errors.add(
      `Cannot book the securities execution of ${describeSecurity(execution)} on ${execution.trade_date}: only stock distributions paid as a dividend in kind are booked without a cash transaction so far`,
    );
    return null;
  }
  if (isCancelledExecution(execution)) {
    errors.add(`Booking the cancellation of ${distribution} is not supported yet`);
    return null;
  }

  try {
    const withheldTax = getDistributionWithheldTax(execution);
    if (Math.abs(withheldTax) >= MIN_AMOUNT) {
      throw new LedgerError(
        `The bank reports ${withheldTax} withheld tax on ${distribution}, and booking tax withheld on a stock distribution is not supported yet`,
      );
    }

    const currency = currencyOfLabel(execution.trade_currency);
    if (!currency) {
      throw new LedgerError(`Cannot book ${distribution}: its execution reports no trade currency`);
    }

    const securityLocality = getSecurityLocality(execution, params.locality);
    if (!securityLocality) {
      throw new LedgerError(
        `Cannot tell whether ${describeSecurity(execution)} of ${distribution} is local or foreign: its execution has no issuer country or ISIN`,
      );
    }
    const incomeKey = INCOME_TAX_CATEGORY_KEYS.DIVIDEND[securityLocality];
    const ids = requireTaxCategories(
      [incomeKey],
      params.taxCategories,
      errors,
      params.missingTaxCategories,
    );
    if (!ids) {
      return null;
    }

    const securitiesTaxCategoryId = await getFinancialAccountTaxCategoryId(injector, {
      account_id: params.securitiesAccountId,
      currency,
    });

    const rate =
      currency === params.defaultLocalCurrency
        ? 1
        : await injector
            .get(ExchangeProvider)
            .getExchangeRates(
              currency,
              params.defaultLocalCurrency,
              distributionValueDate(execution),
            );

    if (currency !== params.defaultLocalCurrency) {
      const mismatch = getBankRateMismatch(execution, rate);
      if (mismatch) {
        // Reported, not fatal: the ledger's rate is the one booked, the difference is for the user
        // to look into.
        errors.add(
          `${distribution[0]!.toUpperCase()}${distribution.slice(1)} is booked at the ledger rate of ${mismatch.ledgerRate} ${params.defaultLocalCurrency} per ${currency}, but the bank priced it at ${mismatch.bankRate}`,
        );
      }
    }

    // A cancellation is a row of its own, which no charge links — so it is looked for here.
    // Ingestion skips distributions cancelled by then; this catches a cancellation that came later.
    if (findDistributionCancellation(execution, await params.getHistory(execution))) {
      errors.add(
        `The bank reports a cancellation of ${distribution}, and booking the reversal is not supported yet`,
      );
    }

    return buildDistributionEntry({
      execution,
      securitiesTaxCategoryId,
      incomeTaxCategoryId: ids[incomeKey],
      currency,
      defaultLocalCurrency: params.defaultLocalCurrency,
      rate,
      ownerId,
      chargeId: params.chargeId,
    });
  } catch (e) {
    errors.add(
      e instanceof LedgerError
        ? e.message
        : `Failed to book ${distribution}: ${(e as Error)?.message ?? e}`,
    );
    return null;
  }
}

export const generateLedgerRecordsForForeignSecurities: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  { insertLedgerRecordsIfNotExists: boolean }
> = async (charge, { insertLedgerRecordsIfNotExists }, { injector }) => {
  const chargeId = charge.id;
  const {
    ownerId,
    defaultLocalCurrency,
    locality,
    foreignSecurities: { taxCategories },
  } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

  const errors: Set<string> = new Set();
  const missingTaxCategories = new Set<SecuritiesTaxCategoryKey>();

  try {
    // validate ledger records are balanced
    const ledgerBalance = new Map<
      string,
      {
        amount: number;
        entityId: string;
        foreignAmounts?: Partial<Record<Currency, { local: number; foreign: number }>>;
      }
    >();

    const transactionsPromise = injector
      .get(TransactionsProvider)
      .transactionsByChargeIDLoader.load(chargeId);

    const financialAccountsPromise = injector
      .get(FinancialAccountsProvider)
      .getFinancialAccountsByOwnerIdLoader.load(ownerId);

    const executionsPromise = injector
      .get(ForeignSecuritiesProvider)
      .getChargeExecutionsByTransactionId(chargeId, charge.owner_id);

    // executions with no cash leg, which the charge books directly
    const linkedExecutionsPromise = injector
      .get(ForeignSecuritiesProvider)
      .executionsByChargeIdLoader.load(chargeId);

    const [
      transactions,
      financialAccounts,
      { mainBusinessId },
      executionsByTransactionId,
      linkedExecutions,
    ] = await Promise.all([
      transactionsPromise,
      financialAccountsPromise,
      getChargeBusinesses(chargeId, injector),
      executionsPromise,
      linkedExecutionsPromise,
    ]);
    const distributions = linkedExecutions.filter(
      execution => execution.owner_id === charge.owner_id,
    );

    const foreignSecuritiesAccountId = financialAccounts.find(
      account => account.type === 'FOREIGN_SECURITIES',
    )?.id;

    if (!foreignSecuritiesAccountId) {
      throw new GraphQLError('Foreign securities account is missing');
    }

    const entriesPromises: Array<Promise<void>> = [];
    const financialAccountLedgerEntries: StrictLedgerProto[] = [];
    const saleRevaluationLedgerEntries: StrictLedgerProto[] = [];
    const distributionLedgerEntries: StrictLedgerProto[] = [];
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];
    const miscExpensesLedgerEntries: LedgerProto[] = [];

    // generate ledger from transactions
    const { mainTransactions, feeTransactions } = splitFeeTransactions(transactions);

    // The bank charges an execution's commission as a fee row of its own, which lands in this
    // charge by reference. The fees are booked as they are either way; this only reports a
    // commission the bank says it took on an income payment that the charge does not show. Every
    // matched execution is counted, since every fee of the security is; only income payments are
    // reported, as the commission convention of trades is not established yet. A distribution's
    // commission is a fee row in a charge of its own until the user merges it into this one, which
    // the error says.
    const isIncome = (execution: SecurityExecutionRow) => {
      const kind = classifySecurityExecution(execution);
      return kind === 'DIVIDEND' || kind === 'INTEREST' || isDividendInKindDistribution(execution);
    };
    const commissionMismatches = validateSecurityCommissions(
      // A merged-in transaction can also be matched to a linked distribution; count it once, or
      // its commission would be expected twice.
      [
        ...new Map(
          [...executionsByTransactionId.values(), ...distributions].map(execution => [
            execution.id,
            execution,
          ]),
        ).values(),
      ],
      feeTransactions,
    ).filter(mismatch => mismatch.executions.some(isIncome));
    for (const mismatch of commissionMismatches) {
      const security = describeSecurity(mismatch.executions[0]!);
      const isDistribution = mismatch.executions.some(execution =>
        distributions.some(distribution => distribution.id === execution.id),
      );
      errors.add(
        mismatch.charged === 0
          ? `A commission of ${formatStringifyAmount(-mismatch.expected)} ${mismatch.currency} was reported for ${security}, but the charge has no fee transaction for it${isDistribution ? ' — merge the charge holding the commission fee into this one' : ''}`
          : `Fee transactions for ${security} charge ${formatStringifyAmount(-mismatch.charged)} ${mismatch.currency}, but the bank reported a commission of ${formatStringifyAmount(-mismatch.expected)} ${mismatch.currency}`,
      );
    }

    const mainTransactionsPromises = mainTransactions.map(async transaction => {
      let baseEntry: StrictLedgerProto;
      try {
        baseEntry = await ledgerEntryFromMainTransaction(
          { ...transaction, source_reference: FOREIGN_SECURITIES_ACCOUNT_NUMBER },
          injector,
          chargeId,
          charge.owner_id,
          mainBusinessId ?? undefined,
        );
      } catch (e) {
        if (e instanceof LedgerError) {
          errors.add(e.message);
          return;
        }
        throw e;
      }

      const [ledgerEntry, ...revaluationEntries] = await securitiesLedgerEntries({
        injector,
        ownerId: charge.owner_id,
        locality,
        defaultLocalCurrency,
        transaction,
        baseEntry,
        execution: executionsByTransactionId.get(transaction.id),
        taxCategories,
        errors,
        missingTaxCategories,
      });
      for (const entry of [ledgerEntry!, ...revaluationEntries]) {
        updateLedgerBalanceByEntry(entry, ledgerBalance, defaultLocalCurrency);
      }
      financialAccountLedgerEntries.push(ledgerEntry!);
      saleRevaluationLedgerEntries.push(...revaluationEntries);
    });

    // create a ledger record for fee transactions
    const feeTransactionsPromises = feeTransactions.map(async transaction => {
      const ids = requireTaxCategories(
        ['FOREIGN_SECURITIES_FEES'],
        taxCategories,
        errors,
        missingTaxCategories,
      );
      if (!ids) {
        return;
      }
      const foreignSecuritiesFeesCategoryId = ids.FOREIGN_SECURITIES_FEES;

      try {
        // for each transaction, create a ledger record
        const { currency, valueDate, exchangeRateDate } =
          validateTransactionBasicVariables(transaction);

        let amount = Number(transaction.amount);
        let foreignAmount: number | undefined = undefined;

        if (currency !== defaultLocalCurrency) {
          // get exchange rate for currency
          const exchangeRate = await injector
            .get(ExchangeProvider)
            .getExchangeRates(currency, defaultLocalCurrency, exchangeRateDate);

          foreignAmount = amount;
          // calculate amounts in ILS:
          amount = exchangeRate * amount;
        }

        const accountTaxCategoryId = await getFinancialAccountTaxCategoryId(injector, transaction);

        const isCreditorCounterparty = amount > 0;

        const ledgerEntry: StrictLedgerProto = {
          id: transaction.id,
          invoiceDate: transaction.event_date,
          valueDate,
          currency,
          creditAccountID1: isCreditorCounterparty
            ? foreignSecuritiesFeesCategoryId
            : accountTaxCategoryId,
          creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyCreditAmount1: Math.abs(amount),
          debitAccountID1: isCreditorCounterparty
            ? accountTaxCategoryId
            : foreignSecuritiesFeesCategoryId,
          debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyDebitAmount1: Math.abs(amount),
          description: transaction.source_description ?? undefined,
          reference: transaction.origin_key,
          isCreditorCounterparty,
          ownerId: charge.owner_id,
          currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
          chargeId,
        };

        feeFinancialAccountLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, defaultLocalCurrency);
      } catch (e) {
        if (e instanceof LedgerError) {
          errors.add(e.message);
          return;
        }
        throw e;
      }
    });

    // generate ledger from misc expenses
    const expensesLedgerPromise = generateMiscExpensesLedger(charge, injector).then(entries => {
      entries.map(entry => {
        entry.ownerId = charge.owner_id;
        miscExpensesLedgerEntries.push(entry);
        updateLedgerBalanceByEntry(entry, ledgerBalance, defaultLocalCurrency);
      });
    });

    // Executions the charge books directly. The history of a security's account is read once, however
    // many of its distributions the charge holds.
    const historyBySecurityAccount = new Map<string, Promise<SecurityExecutionRow[]>>();
    const getHistory = (execution: SecurityExecutionRow) => {
      const key = [
        execution.security,
        execution.bank_number,
        execution.branch_number,
        execution.account_number,
      ].join(':');
      let history = historyBySecurityAccount.get(key);
      if (!history) {
        history = injector
          .get(ForeignSecuritiesProvider)
          .getSecurityAccountHistory(execution, charge.owner_id);
        historyBySecurityAccount.set(key, history);
      }
      return history;
    };
    const distributionsPromises = distributions.map(async execution => {
      const entry = await distributionLedgerEntry({
        injector,
        ownerId: charge.owner_id,
        chargeId,
        locality,
        defaultLocalCurrency,
        execution,
        // owner-scoped, unlike a lookup by account number across the request's business scope
        securitiesAccountId: foreignSecuritiesAccountId,
        getHistory,
        taxCategories,
        errors,
        missingTaxCategories,
      });
      if (entry) {
        distributionLedgerEntries.push(entry);
        updateLedgerBalanceByEntry(entry, ledgerBalance, defaultLocalCurrency);
      }
    });

    entriesPromises.push(
      ...mainTransactionsPromises,
      ...feeTransactionsPromises,
      expensesLedgerPromise,
      ...distributionsPromises,
    );

    await Promise.all(entriesPromises);

    // booked concurrently; keep the charge's own order so regenerations match
    const distributionOrder = new Map(
      distributions.map((execution, index) => [execution.id, index]),
    );
    distributionLedgerEntries.sort(
      (a, b) => (distributionOrder.get(a.id) ?? 0) - (distributionOrder.get(b.id) ?? 0),
    );

    const records = [
      ...financialAccountLedgerEntries,
      ...saleRevaluationLedgerEntries,
      ...distributionLedgerEntries,
      ...feeFinancialAccountLedgerEntries,
      ...miscExpensesLedgerEntries,
    ];
    if (insertLedgerRecordsIfNotExists) {
      await storeInitialGeneratedRecords(charge.id, records, injector);
    }

    const allowedUnbalancedBusinesses = new Set<string>();
    // a charge of fees only has no main entry
    const mainLedgerEntry = financialAccountLedgerEntries[0];
    if (mainLedgerEntry && !mainLedgerEntry.isCreditorCounterparty) {
      allowedUnbalancedBusinesses.add(mainLedgerEntry.debitAccountID1);
    }
    const ledgerBalanceInfo = await getLedgerBalanceInfo(
      injector,
      ledgerBalance,
      errors,
      allowedUnbalancedBusinesses,
    );
    return {
      records: ledgerProtoToRecordsConverter(records),
      charge,
      balance: ledgerBalanceInfo,
      errors: Array.from(errors),
      missingSecuritiesTaxCategories: Array.from(missingTaxCategories),
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
    };
  }
};
