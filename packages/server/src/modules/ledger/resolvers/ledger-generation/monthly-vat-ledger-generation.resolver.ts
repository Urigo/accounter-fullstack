import { format } from 'date-fns';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { generateMiscExpensesLedger } from '@modules/ledger/helpers/misc-expenses-ledger.helper.js';
import { UnbalancedBusinessesProvider } from '@modules/ledger/providers/unbalanced-businesses.provider.js';
import { RawVatReportRecord } from '@modules/reports/helpers/vat-report.helper.js';
import { getVatRecords } from '@modules/reports/resolvers/get-vat-records.resolver.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import type { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import { dateToTimelessDateString, getMonthFromDescription } from '@shared/helpers';
import type { LedgerProto } from '@shared/types';
import { getVatDataFromVatReportRecords } from '../../helpers/monthly-vat-ledger-generation.helper.js';
import {
  generatePartialLedgerEntry,
  getFinancialAccountTaxCategoryId,
  getLedgerBalanceInfo,
  LedgerError,
  ledgerProtoToRecordsConverter,
  updateLedgerBalanceByEntry,
  validateTransactionRequiredVariables,
} from '../../helpers/utils.helper.js';

export const generateLedgerRecordsForMonthlyVat: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  { insertLedgerRecordsIfNotExists: boolean }
> = async (chargeId, { insertLedgerRecordsIfNotExists }, context, __) => {
  const {
    injector,
    adminContext: {
      defaultLocalCurrency,
      authorities: { vatBusinessId, inputVatTaxCategoryId, outputVatTaxCategoryId },
      general: {
        taxCategories: { balanceCancellationTaxCategoryId },
      },
    },
  } = context;

  const charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId);
  if (!charge) {
    return {
      __typename: 'CommonError',
      message: `Charge ID="${chargeId}" not found`,
    };
  }

  const errors: Set<string> = new Set();

  try {
    // figure out VAT month
    const transactionDate =
      charge.transactions_min_debit_date ?? charge.transactions_min_event_date ?? undefined;
    if (!charge.user_description) {
      errors.add(
        `Monthly VAT charge must have description that indicates it's month (ID="${chargeId}")`,
      );
    }
    const vatDates = charge.user_description
      ? getMonthFromDescription(charge.user_description, transactionDate)
      : null;
    if (!vatDates?.length) {
      errors.add(`Cannot extract charge ID="${chargeId}" VAT month`);
    }

    // get VAT relevant records
    const vatRecordsPromises = (vatDates ?? []).map(async vatDate => {
      const [year, month] = (vatDate ?? format(new Date(), 'yyyy-MM')).split('-').map(Number);
      const ledgerDate = new Date(year, month, 0);
      const monthDate = dateToTimelessDateString(new Date(year, month - 1, 15));

      const { income, expenses } = await getVatRecords(
        { filters: { financialEntityId: charge.owner_id, monthDate } },
        context,
      );

      return {
        income,
        expenses,
        ledgerDate,
        vatDate,
      };
    });

    const transactionsPromise = injector
      .get(TransactionsProvider)
      .transactionsByChargeIDLoader.load(chargeId);

    const unbalancedBusinessesPromise = injector
      .get(UnbalancedBusinessesProvider)
      .getChargeUnbalancedBusinessesByChargeIds.load(chargeId);

    const [vatRecords, transactions, unbalancedBusinesses] = await Promise.all([
      Promise.all(vatRecordsPromises),
      transactionsPromise,
      unbalancedBusinessesPromise,
    ]);

    const accountingLedgerEntries: LedgerProto[] = [];
    const financialAccountLedgerEntries: LedgerProto[] = [];
    const miscExpensesLedgerEntries: LedgerProto[] = [];
    const ledgerBalance = new Map<string, { amount: number; entityId: string }>();

    // for each transaction, create a ledger record
    const mainTransactionsPromises = transactions.map(async preValidatedTransaction => {
      try {
        const transaction = validateTransactionRequiredVariables(preValidatedTransaction);
        if (transaction.currency !== defaultLocalCurrency) {
          throw new LedgerError(
            `Monthly VAT currency supposed to be local, got ${transaction.currency}`,
          );
        }

        // preparations for core ledger entries
        let exchangeRate: number | undefined = undefined;
        if (transaction.currency !== defaultLocalCurrency) {
          // get exchange rate for currency
          exchangeRate = await injector
            .get(ExchangeProvider)
            .getExchangeRates(
              transaction.currency,
              defaultLocalCurrency,
              transaction.debit_timestamp,
            );
        }

        const partialEntry = generatePartialLedgerEntry(transaction, charge.owner_id, exchangeRate);

        const financialAccountTaxCategoryId = await getFinancialAccountTaxCategoryId(
          injector,
          transaction,
        );

        const ledgerEntry: LedgerProto = {
          ...partialEntry,
          ...(partialEntry.isCreditorCounterparty
            ? {
                creditAccountID1: vatBusinessId,
                debitAccountID1: financialAccountTaxCategoryId,
              }
            : {
                creditAccountID1: financialAccountTaxCategoryId,
                debitAccountID1: vatBusinessId,
              }),
        };

        financialAccountLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
      } catch (e) {
        if (e instanceof LedgerError) {
          errors.add(e.message);
        } else {
          throw e;
        }
      }
    });

    const miscExpensesLedgerPromise = generateMiscExpensesLedger(charge.id, context).then(
      entries => {
        entries.map(entry => {
          entry.ownerId = charge.owner_id;
          miscExpensesLedgerEntries.push(entry);
          updateLedgerBalanceByEntry(entry, ledgerBalance, context);
        });
      },
    );

    await Promise.all([...mainTransactionsPromises, miscExpensesLedgerPromise]);
    for (const { income, expenses, ledgerDate, vatDate } of vatRecords) {
      const [incomeVat, roundedIncomeVat] = getVatDataFromVatReportRecords(
        income as RawVatReportRecord[],
      );
      const [expensesVat, roundedExpensesVat] = getVatDataFromVatReportRecords(
        expenses as RawVatReportRecord[],
      );

      const accountingLedgerMaterials: Array<{
        amount: number;
        taxCategoryId: string;
        counterpartyId?: string;
      }> = [];
      accountingLedgerMaterials.push(
        {
          amount: roundedIncomeVat,
          taxCategoryId: inputVatTaxCategoryId,
          counterpartyId: vatBusinessId,
        },
        {
          amount: roundedExpensesVat * -1,
          taxCategoryId: outputVatTaxCategoryId,
          counterpartyId: vatBusinessId,
        },
      );

      const roundedIncomeVatDiff = Math.round((roundedIncomeVat - incomeVat) * 100) / 100;
      if (roundedIncomeVatDiff) {
        accountingLedgerMaterials.push({
          amount: roundedIncomeVatDiff * -1,
          taxCategoryId: inputVatTaxCategoryId,
          counterpartyId: balanceCancellationTaxCategoryId,
        });
      }

      const roundedExpensesVatDiff = Math.round((roundedExpensesVat - expensesVat) * 100) / 100;
      if (roundedExpensesVatDiff) {
        accountingLedgerMaterials.push({
          amount: roundedExpensesVatDiff,
          taxCategoryId: outputVatTaxCategoryId,
          counterpartyId: balanceCancellationTaxCategoryId,
        });
      }

      accountingLedgerMaterials.map(({ amount, taxCategoryId, counterpartyId }) => {
        if (amount === 0) {
          return;
        }

        const isCreditorCounterparty = amount > 0;

        const ledgerProto: LedgerProto = {
          id: chargeId,
          invoiceDate: ledgerDate,
          valueDate: ledgerDate,
          currency: defaultLocalCurrency,
          creditAccountID1: isCreditorCounterparty ? counterpartyId : taxCategoryId,
          localCurrencyCreditAmount1: Math.abs(amount),
          debitAccountID1: isCreditorCounterparty ? taxCategoryId : counterpartyId,
          localCurrencyDebitAmount1: Math.abs(amount),
          description:
            counterpartyId === balanceCancellationTaxCategoryId
              ? 'Balance cancellation'
              : `VAT command ${vatDate}`,
          isCreditorCounterparty,
          ownerId: charge.owner_id,
          chargeId,
        };

        accountingLedgerEntries.push(ledgerProto);
        updateLedgerBalanceByEntry(ledgerProto, ledgerBalance, context);
      });
    }

    const allowedUnbalancedBusinesses = new Set(
      unbalancedBusinesses.map(({ business_id }) => business_id),
    );

    const ledgerBalanceInfo = await getLedgerBalanceInfo(
      context,
      ledgerBalance,
      errors,
      allowedUnbalancedBusinesses,
    );

    const records = [
      ...financialAccountLedgerEntries,
      ...accountingLedgerEntries,
      ...miscExpensesLedgerEntries,
    ];

    if (insertLedgerRecordsIfNotExists) {
      await storeInitialGeneratedRecords(charge.id, records, context);
    }

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
