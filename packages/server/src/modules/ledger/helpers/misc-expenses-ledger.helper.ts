import type { Injector } from 'graphql-modules';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { MiscExpensesProvider } from '@modules/misc-expenses/providers/misc-expenses.provider.js';
import type { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types.js';
import { DEFAULT_LOCAL_CURRENCY, EMPTY_UUID } from '@shared/constants';
import type { LedgerProto } from '@shared/types';
import { isSupplementalFeeTransaction } from './fee-transactions.js';
import {
  getFinancialAccountTaxCategoryId,
  validateTransactionBasicVariables,
} from './utils.helper.js';

export async function generateMiscExpensesLedger(
  transaction: IGetTransactionsByChargeIdsResult,
  injector: Injector,
): Promise<LedgerProto[]> {
  const expenses = await injector
    .get(MiscExpensesProvider)
    .getExpensesByTransactionIdLoader.load(transaction.id);
  if (!expenses.length) {
    return [];
  }

  const {
    currency,
    valueDate,
    transactionBusinessId: businessId,
  } = validateTransactionBasicVariables(transaction);

  const isSupplementalFee = isSupplementalFeeTransaction(transaction);

  let mainAccount = businessId;
  if (isSupplementalFee) {
    mainAccount = await getFinancialAccountTaxCategoryId(injector, transaction);
  }

  const ledgerEntries: LedgerProto[] = [];
  for (const expense of expenses) {
    let amount = Number(expense.amount);
    let foreignAmount: number | undefined = undefined;
    if (currency !== DEFAULT_LOCAL_CURRENCY) {
      // get exchange rate for currency
      const exchangeRate = await injector
        .get(ExchangeProvider)
        .getExchangeRates(currency, DEFAULT_LOCAL_CURRENCY, valueDate);

      foreignAmount = amount;
      // calculate amounts in local currency
      amount = exchangeRate * amount;
    }

    const isCreditorCounterparty = Number(expense.amount) < 0;

    const entry: LedgerProto = {
      id: EMPTY_UUID,
      chargeId: transaction.charge_id,
      ownerId: EMPTY_UUID,
      currency,
      ...(foreignAmount && {
        creditAmount1: Math.abs(foreignAmount),
        debitAmount1: Math.abs(foreignAmount),
      }),
      ...(isCreditorCounterparty
        ? {
            creditAccountID1: mainAccount,
            debitAccountID1: expense.counterparty,
          }
        : {
            creditAccountID1: expense.counterparty,
            debitAccountID1: mainAccount,
          }),
      localCurrencyCreditAmount1: Math.abs(amount),
      localCurrencyDebitAmount1: Math.abs(amount),
      description: expense.description ?? undefined,
      valueDate,
      invoiceDate: expense.date ?? transaction.event_date,
      isCreditorCounterparty,
    };
    ledgerEntries.push(entry);
  }
  return ledgerEntries;
}
