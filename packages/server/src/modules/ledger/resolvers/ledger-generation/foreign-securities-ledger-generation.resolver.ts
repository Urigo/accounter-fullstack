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
import type { LedgerProto, StrictLedgerProto } from '../../../../shared/types/index.js';
import {
  securitiesTaxCategoryLabel,
  type SecuritiesTaxCategoryIds,
} from '../../../admin-context/helpers/securities-context.helper.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { getChargeBusinesses } from '../../../charges/helpers/common.helper.js';
import { ExchangeProvider } from '../../../exchange-rates/providers/exchange.provider.js';
import { FinancialAccountsProvider } from '../../../financial-accounts/providers/financial-accounts.provider.js';
import { calculateFifoCostBasis } from '../../../foreign-securities/helpers/security-cost-basis.helper.js';
import { ForeignSecuritiesProvider } from '../../../foreign-securities/providers/foreign-securities.provider.js';
import type { SecurityExecutionRow } from '../../../foreign-securities/types.js';
import { TransactionsProvider } from '../../../transactions/providers/transactions.provider.js';
import type { IGetTransactionsByChargeIdsResult } from '../../../transactions/types.js';
import { ledgerEntryFromMainTransaction } from '../../helpers/common-charge-ledger.helper.js';
import { splitFeeTransactions } from '../../helpers/fee-transactions.js';
import {
  buildIncomeEntry,
  buildRedemptionEntry,
  calculateRedemptionGain,
  classifySecurityExecution,
  getSecurityLocality,
  getWithheldTax,
  INCOME_TAX_CATEGORY_KEYS,
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

/** How a ledger error names a cash movement, so the user can find it in the charge */
function describeTransaction(transaction: IGetTransactionsByChargeIdsResult): string {
  const date = transaction.debit_date_override ?? transaction.debit_date ?? transaction.event_date;
  return `"${transaction.source_description ?? transaction.id}" (${date}, ${transaction.amount} ${transaction.currency})`;
}

function describeSecurity(execution: SecurityExecutionRow): string {
  const name = execution.symbol ?? execution.security;
  return execution.isin ? `${name} (${execution.isin})` : name;
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
        `Missing securities tax category "${securitiesTaxCategoryLabel(key)}" — set it from the charge's ledger errors to book securities income and redemptions`,
      );
    }
    return null;
  }
  return Object.fromEntries(keys.map(key => [key, taxCategories[key]])) as Record<TKey, string>;
}

/** Why the FIFO purchase cost of a redemption cannot be worked out, or null when it can */
function costBasisProblem(
  execution: SecurityExecutionRow,
  costBasis: ReturnType<typeof calculateFifoCostBasis>,
): string | null {
  const security = describeSecurity(execution);
  const redeemed = execution.trade_date;
  const bankProfitLoss = Number(execution.nominal_profit_loss_nis);
  const bankNote =
    Number.isFinite(bankProfitLoss) && bankProfitLoss !== 0
      ? ` For reference, the bank reports a nominal profit/loss of ${bankProfitLoss} ₪ on it.`
      : '';

  if (costBasis.redeemedUnits === 0) {
    return `The redemption of ${security} on ${redeemed} reports no redeemed units, so its purchase cost cannot be found.${bankNote}`;
  }
  if (costBasis.openingPositionUnknown) {
    const history = costBasis.historyStartDate
      ? ` (it starts on ${costBasis.historyStartDate})`
      : '';
    return `Could not determine the purchase cost of ${costBasis.redeemedUnits} units of ${security} redeemed on ${redeemed}: the scraped securities history of this account${history} starts mid-position — units were sold or transferred out before as many were seen bought, so an earlier holding of unknown cost comes first. Scrape older securities transactions of this account to complete it.${bankNote}`;
  }
  if (costBasis.missingUnits > 0) {
    const history = costBasis.historyStartDate
      ? `the scraped securities history of this account starts on ${costBasis.historyStartDate}`
      : 'no securities history of it was scraped for this account';
    return `Could not find the purchase of ${costBasis.missingUnits} of ${costBasis.redeemedUnits} units of ${security} redeemed on ${redeemed}: ${history}. Scrape older securities transactions of this account to complete it.${bankNote}`;
  }
  if (costBasis.unknownCostUnits > 0) {
    return `${costBasis.unknownCostUnits} of ${costBasis.redeemedUnits} units of ${security} redeemed on ${redeemed} have no known purchase cost: they arrived by transfer or distribution, or were bought in another currency.${bankNote}`;
  }
  return null;
}

/**
 * The entry for one cash movement: the base entry (bank ↔ securities account), reshaped by the
 * execution behind it for dividends, bond interest and redemptions. Anything that prevents that
 * is recorded as a ledger error and leaves the base entry as it is.
 */
async function securitiesLedgerEntry(params: {
  injector: Injector;
  ownerId: string;
  transaction: IGetTransactionsByChargeIdsResult;
  baseEntry: StrictLedgerProto;
  execution: SecurityExecutionRow | undefined;
  taxCategories: SecuritiesTaxCategoryIds;
  errors: Set<string>;
  missingTaxCategories: Set<SecuritiesTaxCategoryKey>;
}): Promise<StrictLedgerProto> {
  const { injector, ownerId, transaction, baseEntry, execution, taxCategories, errors } = params;
  const transactionDescription = describeTransaction(transaction);

  if (!execution) {
    errors.add(
      `Transaction ${transactionDescription} has no matched security execution — make sure the securities transactions of its account were scraped for that day`,
    );
    return baseEntry;
  }

  const kind = classifySecurityExecution(execution);
  if (kind === 'OTHER') {
    return baseEntry;
  }

  try {
    const cashCurrency = baseEntry.currency;
    const tax = getWithheldTax(execution, cashCurrency);
    if (!tax.isConsistent) {
      errors.add(
        `Withheld tax of ${tax.withheld} ${cashCurrency} reported for transaction ${transactionDescription} does not match gross minus net (${tax.deduced} ${cashCurrency})`,
      );
    }
    const withholdingKeys =
      Math.abs(tax.withheld) >= MIN_AMOUNT ? [WITHHOLDING_TAX_CATEGORY_KEYS[kind]] : [];

    if (kind === 'DIVIDEND' || kind === 'INTEREST') {
      const locality = getSecurityLocality(execution);
      if (!locality) {
        throw new LedgerError(
          `Cannot tell whether ${describeSecurity(execution)} of transaction ${transactionDescription} is local or foreign: its execution has no issuer country or ISIN`,
        );
      }
      const incomeKey = INCOME_TAX_CATEGORY_KEYS[kind][locality];
      const ids = requireTaxCategories(
        [incomeKey, ...withholdingKeys],
        taxCategories,
        errors,
        params.missingTaxCategories,
      );
      if (!ids) {
        return baseEntry;
      }
      return buildIncomeEntry(baseEntry, {
        incomeTaxCategoryId: ids[incomeKey],
        withholdingTaxCategoryId: withholdingKeys.length
          ? ids[WITHHOLDING_TAX_CATEGORY_KEYS[kind]]
          : undefined,
        withheldTax: tax.withheld,
      });
    }

    // a redemption
    const history = await injector
      .get(ForeignSecuritiesProvider)
      .getSecurityAccountHistory(execution, ownerId);
    const costBasis = calculateFifoCostBasis(history, execution, cashCurrency);
    const problem = costBasisProblem(execution, costBasis);
    if (problem) {
      throw new LedgerError(problem);
    }

    const gain = calculateRedemptionGain(baseEntry, {
      costForeign: costBasis.costForeign,
      withheldTax: tax.withheld,
    });
    const gainOrLossKeys: SecuritiesTaxCategoryKey[] =
      gain >= MIN_AMOUNT
        ? ['FOREIGN_SECURITIES_SALE_GAIN']
        : gain <= -MIN_AMOUNT
          ? ['FOREIGN_SECURITIES_SALE_LOSS']
          : [];
    const ids = requireTaxCategories(
      [...gainOrLossKeys, ...withholdingKeys],
      taxCategories,
      errors,
      params.missingTaxCategories,
    );
    if (!ids) {
      return baseEntry;
    }
    return buildRedemptionEntry(baseEntry, {
      costForeign: costBasis.costForeign,
      withheldTax: tax.withheld,
      gainTaxCategoryId: taxCategories.FOREIGN_SECURITIES_SALE_GAIN,
      lossTaxCategoryId: taxCategories.FOREIGN_SECURITIES_SALE_LOSS,
      withholdingTaxCategoryId: taxCategories.BOND_WITHHOLDING_TAX,
    });
  } catch (e) {
    errors.add(
      e instanceof LedgerError
        ? e.message
        : `Failed to book the security execution of transaction ${transactionDescription}: ${(e as Error)?.message ?? e}`,
    );
    return baseEntry;
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

    const [transactions, financialAccounts, { mainBusinessId }, executionsByTransactionId] =
      await Promise.all([
        transactionsPromise,
        financialAccountsPromise,
        getChargeBusinesses(chargeId, injector),
        executionsPromise,
      ]);

    const foreignSecuritiesAccountId = financialAccounts.find(
      account => account.type === 'FOREIGN_SECURITIES',
    )?.id;

    if (!foreignSecuritiesAccountId) {
      throw new GraphQLError('Foreign securities account is missing');
    }

    const entriesPromises: Array<Promise<void>> = [];
    const financialAccountLedgerEntries: StrictLedgerProto[] = [];
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];
    const miscExpensesLedgerEntries: LedgerProto[] = [];

    // generate ledger from transactions
    const { mainTransactions, feeTransactions } = splitFeeTransactions(transactions);

    const mainTransactionsPromises = mainTransactions.map(async transaction => {
      let baseEntry: StrictLedgerProto;
      try {
        baseEntry = await ledgerEntryFromMainTransaction(
          { ...transaction, source_reference: 'foreign_securities' },
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

      const ledgerEntry = await securitiesLedgerEntry({
        injector,
        ownerId: charge.owner_id,
        transaction,
        baseEntry,
        execution: executionsByTransactionId.get(transaction.id),
        taxCategories,
        errors,
        missingTaxCategories,
      });
      financialAccountLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, defaultLocalCurrency);
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

    entriesPromises.push(
      ...mainTransactionsPromises,
      ...feeTransactionsPromises,
      expensesLedgerPromise,
    );

    await Promise.all(entriesPromises);

    const records = [
      ...financialAccountLedgerEntries,
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
