import type {
  Maybe,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '../../../../__generated__/types.js';
import type { Currency } from '../../../../shared/enums.js';
import type { LedgerProto, StrictLedgerProto } from '../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { BankDepositChargesProvider } from '../../../bank-deposits/providers/bank-deposit-charges.provider.js';
import {
  DepositTimelineProvider,
  type DepositTimelineResult,
} from '../../../bank-deposits/providers/deposit-timeline.provider.js';
import { getChargeBusinesses } from '../../../charges/helpers/common.helper.js';
import { ExchangeProvider } from '../../../exchange-rates/providers/exchange.provider.js';
import { TaxCategoriesProvider } from '../../../financial-entities/providers/tax-categories.provider.js';
import { TransactionsProvider } from '../../../transactions/providers/transactions.provider.js';
import type { IGetTransactionsByChargeIdsResult } from '../../../transactions/types.js';
import { ledgerEntryFromMainTransaction } from '../../helpers/common-charge-ledger.helper.js';
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

export const generateLedgerRecordsForBankDeposit: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  { insertLedgerRecordsIfNotExists: boolean }
> = async (charge, { insertLedgerRecordsIfNotExists }, { injector }) => {
  const chargeId = charge.id;
  const {
    defaultLocalCurrency,
    general: {
      taxCategories: { exchangeRateTaxCategoryId },
    },
    bankDeposits: {
      bankDepositBusinessId,
      bankDepositInterestIncomeTaxCategoryId,
      bankDepositWithholdingTaxCategoryId,
    },
  } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

  const errors: Set<string> = new Set();

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

    const [transactions, { mainBusinessId }] = await Promise.all([
      transactionsPromise,
      getChargeBusinesses(chargeId, injector),
    ]);

    const entriesPromises: Array<Promise<void>> = [];
    const financialAccountLedgerEntries: StrictLedgerProto[] = [];
    const interestLedgerEntries: StrictLedgerProto[] = [];
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];
    // tax categories the visible interest lines were booked to, with their (local) amounts
    const interestTaxCategories: Array<{ taxCategoryId: string; amount: number }> = [];

    let isWithdrawal = false;

    // generate ledger from transactions
    const [mainTransaction, interestTransactions] = transactions.reduce(
      (
        [mainTransaction, interestTransactions]: [
          IGetTransactionsByChargeIdsResult,
          IGetTransactionsByChargeIdsResult[],
        ],
        current,
      ) => {
        if (mainTransaction.id === current.id) {
          return [mainTransaction, interestTransactions];
        }
        // the principal movement is the largest one (same rule as the deposit timeline)
        return Math.abs(Number(current.amount)) > Math.abs(Number(mainTransaction.amount))
          ? [current, [mainTransaction, ...interestTransactions]]
          : [mainTransaction, [current, ...interestTransactions]];
      },
      [transactions[0], []],
    );

    if (Number(mainTransaction.amount) > 0) {
      isWithdrawal = true;
    }

    const mainTransactionPromise = async () =>
      ledgerEntryFromMainTransaction(
        mainTransaction,
        injector,
        chargeId,
        charge.owner_id,
        mainBusinessId ?? undefined,
      )
        .then(ledgerEntry => {
          financialAccountLedgerEntries.push(ledgerEntry);
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, defaultLocalCurrency);
        })
        .catch(e => {
          if (e instanceof LedgerError) {
            errors.add(e.message);
          } else {
            throw e;
          }
        });

    // create a ledger record for fee transactions
    const interestTransactionsPromises = interestTransactions.map(async transaction => {
      // for each transaction, create a ledger record
      const { currency, valueDate, exchangeRateDate, transactionBusinessId } =
        validateTransactionBasicVariables(transaction);

      const businessTaxCategory = await injector
        .get(TaxCategoriesProvider)
        .taxCategoryByBusinessIDsLoader.load(transactionBusinessId);
      if (!businessTaxCategory) {
        errors.add(`Business ID="${transactionBusinessId}" is missing tax category`);
        return;
      }

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
        creditAccountID1: isCreditorCounterparty ? businessTaxCategory.id : accountTaxCategoryId,
        creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyCreditAmount1: Math.abs(amount),
        debitAccountID1: isCreditorCounterparty ? accountTaxCategoryId : businessTaxCategory.id,
        debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyDebitAmount1: Math.abs(amount),
        description: transaction.source_description ?? undefined,
        reference: transaction.origin_key,
        isCreditorCounterparty,
        ownerId: charge.owner_id,
        currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
        chargeId,
      };

      interestLedgerEntries.push(ledgerEntry);
      interestTaxCategories.push({ taxCategoryId: businessTaxCategory.id, amount });
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, defaultLocalCurrency);
    });

    // generate ledger from misc expenses
    const expensesLedgerPromise = generateMiscExpensesLedger(charge, injector).then(entries => {
      entries.map(entry => {
        entry.ownerId = charge.owner_id;
        feeFinancialAccountLedgerEntries.push(entry);
        updateLedgerBalanceByEntry(entry, ledgerBalance, defaultLocalCurrency);
      });
    });

    entriesPromises.push(
      mainTransactionPromise(),
      ...interestTransactionsPromises,
      expensesLedgerPromise,
    );

    await Promise.all(entriesPromises);

    const miscLedgerEntries: StrictLedgerProto[] = [];
    const mainLedgerEntry = financialAccountLedgerEntries[0];
    // the deposit side of the main entry: the deposit business the bank movement is booked against
    const depositAccountId =
      mainTransaction.business_id ?? bankDepositBusinessId ?? mainBusinessId ?? undefined;

    const depositEntriesPromise = async () => {
      if (!mainLedgerEntry) {
        throw new LedgerError('Main ledger entry not found');
      }
      if (!depositAccountId) {
        throw new LedgerError('Bank deposit business is not set');
      }

      const deposit = await injector
        .get(BankDepositChargesProvider)
        .getBankDepositByChargeIdLoader.load(chargeId);
      if (!deposit) {
        if (isWithdrawal) {
          throw new LedgerError('Withdrawal charge is not assigned to a bank deposit');
        }
        return;
      }

      let timeline: DepositTimelineResult;
      try {
        timeline = await injector
          .get(DepositTimelineProvider)
          .depositTimelineLoader.load(deposit.id);
      } catch (e) {
        throw new LedgerError(
          `Failed to build bank deposit timeline: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      const step = timeline.steps.find(s => s.chargeId === chargeId);
      if (!step) {
        throw new LedgerError('Charge not found in its bank deposit timeline');
      }
      for (const warning of step.warnings) {
        errors.add(warning);
      }

      const common = {
        invoiceDate: mainLedgerEntry.valueDate,
        valueDate: mainLedgerEntry.valueDate,
        ownerId: charge.owner_id,
        chargeId,
        reference: mainTransaction.origin_key,
      };
      const depositCurrency = timeline.currency as Currency;
      const isForeign = depositCurrency !== defaultLocalCurrency;

      const push = (entry: StrictLedgerProto) => {
        miscLedgerEntries.push(entry);
        updateLedgerBalanceByEntry(entry, ledgerBalance, defaultLocalCurrency);
      };

      // 1. FX revaluation of the whole carried principal to this event's rate
      if (Math.abs(step.revaluation) >= 0.005) {
        const isUp = step.revaluation > 0;
        const amount = Math.abs(step.revaluation);
        push({
          ...common,
          id: mainTransaction.id + '|revaluation',
          debitAccountID1: isUp ? depositAccountId : exchangeRateTaxCategoryId,
          creditAccountID1: isUp ? exchangeRateTaxCategoryId : depositAccountId,
          localCurrencyDebitAmount1: amount,
          localCurrencyCreditAmount1: amount,
          description: 'Bank deposit revaluation',
          isCreditorCounterparty: !isUp,
          currency: defaultLocalCurrency,
        });
      }

      // 2. interest the bank realized on the whole deposit and re-deposited
      if (Math.abs(step.capitalizedInterest) >= 0.005) {
        if (!bankDepositInterestIncomeTaxCategoryId) {
          throw new LedgerError(
            'Bank deposit interest income tax category is not set (needed for capitalized interest)',
          );
        }
        const isIncome = step.capitalizedInterest > 0;
        const local = Math.abs(step.capitalizedInterestLocal);
        const foreign = isForeign ? Math.abs(step.capitalizedInterest) : undefined;
        push({
          ...common,
          id: mainTransaction.id + '|interest',
          debitAccountID1: isIncome ? depositAccountId : bankDepositInterestIncomeTaxCategoryId,
          creditAccountID1: isIncome ? bankDepositInterestIncomeTaxCategoryId : depositAccountId,
          debitAmount1: foreign,
          creditAmount1: foreign,
          localCurrencyDebitAmount1: local,
          localCurrencyCreditAmount1: local,
          description:
            step.source === 'INFERRED'
              ? 'Bank deposit capitalized interest (inferred)'
              : 'Bank deposit capitalized interest',
          isCreditorCounterparty: !isIncome,
          currency: isForeign ? depositCurrency : defaultLocalCurrency,
          currencyRate: isForeign ? step.rate : undefined,
        });
      }

      // 3. tax withheld by the bank: inside the deposit, and on the paid-out interest.
      // The paid-out gross-up credits the same account as this charge's visible interest line
      // (the largest one when there are several), so gross interest stays in one income account.
      const visibleInterestTaxCategoryId =
        interestTaxCategories.length > 0
          ? interestTaxCategories.reduce((a, b) =>
              Math.abs(b.amount) > Math.abs(a.amount) ? b : a,
            ).taxCategoryId
          : null;
      const taxEntries: Array<{ amount: number; suffix: string; counterAccount: string | null }> = [
        { amount: step.taxCapitalized, suffix: '|tax', counterAccount: depositAccountId },
        {
          amount: step.taxPaidOut,
          suffix: '|tax-paid-out',
          counterAccount: visibleInterestTaxCategoryId ?? bankDepositInterestIncomeTaxCategoryId,
        },
      ];
      for (const { amount: tax, suffix, counterAccount } of taxEntries) {
        if (Math.abs(tax) < 0.005) continue;
        if (!bankDepositWithholdingTaxCategoryId) {
          throw new LedgerError('Bank deposit withholding tax category is not set');
        }
        if (!counterAccount) {
          throw new LedgerError('Bank deposit interest income tax category is not set');
        }
        const isCharged = tax > 0;
        const amount = Math.abs(tax);
        push({
          ...common,
          id: mainTransaction.id + suffix,
          debitAccountID1: isCharged ? bankDepositWithholdingTaxCategoryId : counterAccount,
          creditAccountID1: isCharged ? counterAccount : bankDepositWithholdingTaxCategoryId,
          localCurrencyDebitAmount1: amount,
          localCurrencyCreditAmount1: amount,
          description: 'Bank deposit interest tax withheld',
          isCreditorCounterparty: isCharged,
          currency: defaultLocalCurrency,
        });
      }
    };

    await depositEntriesPromise().catch(e => {
      if (e instanceof LedgerError) {
        errors.add(e.message);
      } else {
        throw e;
      }
    });

    const records = [
      ...financialAccountLedgerEntries,
      ...interestLedgerEntries,
      ...feeFinancialAccountLedgerEntries,
      ...miscLedgerEntries,
    ];
    if (insertLedgerRecordsIfNotExists) {
      await storeInitialGeneratedRecords(charge.id, records, injector);
    }

    // the deposit business is a carried balance-sheet account: it balances across the deposit's
    // charges, not within one
    const allowedUnbalancedBusinesses = new Set<string>();
    if (depositAccountId) {
      allowedUnbalancedBusinesses.add(depositAccountId);
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
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
    };
  }
};
