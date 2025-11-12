import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { ledgerEntryFromMainTransaction } from '@modules/ledger/helpers/common-charge-ledger.helper.js';
import { splitFeeTransactions } from '@modules/ledger/helpers/fee-transactions.js';
import { generateMiscExpensesLedger } from '@modules/ledger/helpers/misc-expenses-ledger.helper.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import type {
  Currency,
  Maybe,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import type { LedgerProto, StrictLedgerProto } from '@shared/types';
import { storeInitialGeneratedRecords } from '../../helpers/ledgrer-storage.helper.js';
import {
  getFinancialAccountTaxCategoryId,
  getLedgerBalanceInfo,
  LedgerError,
  ledgerProtoToRecordsConverter,
  updateLedgerBalanceByEntry,
  validateTransactionBasicVariables,
} from '../../helpers/utils.helper.js';

export const generateLedgerRecordsForForeignSecurities: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  { insertLedgerRecordsIfNotExists: boolean }
> = async (chargeId, { insertLedgerRecordsIfNotExists }, context) => {
  const {
    injector,
    adminContext: {
      defaultAdminBusinessId,
      defaultLocalCurrency,
      foreignSecurities: { foreignSecuritiesFeesCategoryId },
    },
  } = context;

  const charge = await context.injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId);
  if (!charge) {
    return {
      __typename: 'CommonError',
      message: `Charge ID="${chargeId}" not found`,
    };
  }

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

    const financialAccountsPromise = injector
      .get(FinancialAccountsProvider)
      .getFinancialAccountsByOwnerIdLoader.load(defaultAdminBusinessId);

    const [transactions, financialAccounts] = await Promise.all([
      transactionsPromise,
      financialAccountsPromise,
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

    const mainTransactionsPromises = mainTransactions.map(
      async transaction =>
        await ledgerEntryFromMainTransaction(
          { ...transaction, source_reference: 'foreign_securities' },
          context,
          chargeId,
          charge.owner_id,
          charge.business_id ?? undefined,
        )
          .then(ledgerEntry => {
            financialAccountLedgerEntries.push(ledgerEntry);
            updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
          })
          .catch(e => {
            if (e instanceof LedgerError) {
              errors.add(e.message);
            } else {
              throw e;
            }
          }),
    );

    // create a ledger record for fee transactions
    const feeTransactionsPromises = feeTransactions.map(async transaction => {
      if (!foreignSecuritiesFeesCategoryId) {
        errors.add(`Foreign securities fees category ID is missing`);
        return;
      }

      // for each transaction, create a ledger record
      const { currency, valueDate } = validateTransactionBasicVariables(transaction);

      let amount = Number(transaction.amount);
      let foreignAmount: number | undefined = undefined;

      if (currency !== defaultLocalCurrency) {
        // get exchange rate for currency
        const exchangeRate = await injector
          .get(ExchangeProvider)
          .getExchangeRates(currency, defaultLocalCurrency, valueDate);

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
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
    });

    // generate ledger from misc expenses
    const expensesLedgerPromise = generateMiscExpensesLedger(charge, context).then(entries => {
      entries.map(entry => {
        entry.ownerId = charge.owner_id;
        miscExpensesLedgerEntries.push(entry);
        updateLedgerBalanceByEntry(entry, ledgerBalance, context);
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
      await storeInitialGeneratedRecords(charge.id, records, context);
    }

    const allowedUnbalancedBusinesses = new Set<string>();
    const mainLedgerEntry = financialAccountLedgerEntries[0];
    if (!mainLedgerEntry.isCreditorCounterparty) {
      allowedUnbalancedBusinesses.add(mainLedgerEntry.debitAccountID1);
    }
    const ledgerBalanceInfo = await getLedgerBalanceInfo(
      context,
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
