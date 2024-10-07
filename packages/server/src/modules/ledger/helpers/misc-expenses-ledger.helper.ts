import type { Injector } from 'graphql-modules';
import { IGetChargesByIdsResult } from '@modules/charges/types.js';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { MiscExpensesProvider } from '@modules/misc-expenses/providers/misc-expenses.provider.js';
import { DEFAULT_LOCAL_CURRENCY, EMPTY_UUID } from '@shared/constants';
import { Currency } from '@shared/enums';
import type { LedgerProto } from '@shared/types';

export async function generateMiscExpensesLedger(
  charge: IGetChargesByIdsResult,
  injector: Injector,
): Promise<LedgerProto[]> {
  const expenses = await injector
    .get(MiscExpensesProvider)
    .getExpensesByChargeIdLoader.load(charge.id);
  if (!expenses.length) {
    return [];
  }

  const ledgerEntries: LedgerProto[] = [];
  for (const expense of expenses) {
    let amount = Number(expense.amount);
    let foreignAmount: number | undefined = undefined;
    if (expense.currency !== DEFAULT_LOCAL_CURRENCY) {
      // get exchange rate for currency
      const exchangeRate = await injector
        .get(ExchangeProvider)
        .getExchangeRates(expense.currency as Currency, DEFAULT_LOCAL_CURRENCY, expense.value_date);

      foreignAmount = amount;
      // calculate amounts in local currency
      amount = exchangeRate * amount;
    }

    const entry: LedgerProto = {
      id: EMPTY_UUID,
      chargeId: expense.charge_id,
      ownerId: EMPTY_UUID,
      currency: expense.currency as Currency,
      ...(foreignAmount && {
        creditAmount1: Math.abs(foreignAmount),
        debitAmount1: Math.abs(foreignAmount),
      }),
      creditAccountID1: expense.creditor_id,
      debitAccountID1: expense.debtor_id,
      localCurrencyCreditAmount1: Math.abs(amount),
      localCurrencyDebitAmount1: Math.abs(amount),
      description: expense.description ?? undefined,
      valueDate: expense.value_date,
      invoiceDate: expense.invoice_date,
      isCreditorCounterparty: true,
    };
    ledgerEntries.push(entry);
  }
  return ledgerEntries;
}
