import type { Injector } from 'graphql-modules';
import { AuthoritiesMiscExpensesProvider } from '@modules/authorities-misc-expenses/providers/authorities-misc-expenses.provider.js';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import type { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types.js';
import { DEFAULT_LOCAL_CURRENCY, EMPTY_UUID } from '@shared/constants';
import type { LedgerProto } from '@shared/types';
import {
  getFinancialAccountTaxCategoryId,
  validateTransactionBasicVariables,
} from './utils.helper.js';

async function doesIncludeAuthority(
  transaction: IGetTransactionsByChargeIdsResult,
  injector: Injector,
): Promise<boolean> {
  const authorities = await injector.get(AuthoritiesMiscExpensesProvider).getAllAuthorities();
  const authoritiesIds = authorities.map(authority => authority.id);
  if (transaction.business_id && authoritiesIds.includes(transaction.business_id)) {
    return true;
  }
  return false;
}

export async function generateAuthoritiesExpensesLedger(
  transaction: IGetTransactionsByChargeIdsResult,
  injector: Injector,
): Promise<LedgerProto[]> {
  if (await doesIncludeAuthority(transaction, injector)) {
    const expenses = await injector
      .get(AuthoritiesMiscExpensesProvider)
      .getExpensesByTransactionIdLoader.load(transaction.id);
    if (!expenses.length) {
      return [];
    }

    const {
      currency,
      valueDate,
      transactionBusinessId: authorityId,
    } = validateTransactionBasicVariables(transaction);

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

      const financialAccountTaxCategoryId = await getFinancialAccountTaxCategoryId(
        injector,
        transaction,
      );

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
              creditAccountID1: authorityId,
              debitAccountID1: financialAccountTaxCategoryId,
            }
          : {
              creditAccountID1: financialAccountTaxCategoryId,
              debitAccountID1: authorityId,
            }),
        localCurrencyCreditAmount1: Math.abs(amount),
        localCurrencyDebitAmount1: Math.abs(amount),
        description: expense.description ?? undefined,
        valueDate,
        invoiceDate: transaction.event_date,
        isCreditorCounterparty,
      };
      ledgerEntries.push(entry);
    }
    return ledgerEntries;
  }
  return [];
}
