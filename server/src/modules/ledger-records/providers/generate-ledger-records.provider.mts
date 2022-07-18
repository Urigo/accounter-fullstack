import { Injectable, Scope } from 'graphql-modules';

import { getILSForDate } from '../../../helpers/exchange.mjs';
import {
  EntryForAccounting,
  EntryForFinancialAccount,
  swapObjectKeys,
  VatExtendedCharge,
} from '../../../helpers/misc.mjs';
import type { VatIndexesKeys } from '../../hashavshevet/providers/hashavshevet.provider.mjs';
import { ExchangeProvider } from '../../providers/exchange.providers.mjs';

@Injectable({
  scope: Scope.Singleton,
  global: false,
})
export class GenerateLedgerRecordsProvider {
  constructor(private exchangeProvider: ExchangeProvider) {}

  public buildLedgerEntries = async (
    charge: VatExtendedCharge,
    originalAmount: number,
    hashVATIndexes: Record<VatIndexesKeys, string>
  ): Promise<{
    entryForFinancialAccount: EntryForFinancialAccount;
    entryForAccounting: EntryForAccounting;
  }> => {
    const chargeAmount = parseFloat(charge.event_amount);

    // entryForFinancialAccount setup
    const entryForFinancialAccount: Partial<EntryForFinancialAccount> = {};

    entryForFinancialAccount.creditAccount = charge.financial_entity;
    entryForFinancialAccount.debitAccount = charge.account_type;

    entryForFinancialAccount.creditAmount = entryForFinancialAccount.debitAmount = chargeAmount;

    if (!charge.debit_date) {
      throw new Error(`Chare id=${charge.id} is missing debit date`);
    }

    const { debitExchangeRates, invoiceExchangeRates } = await this.exchangeProvider.getChargeExchangeRates(charge);

    entryForFinancialAccount.creditAmountILS = entryForFinancialAccount.debitAmountILS = charge.debit_date
      ? getILSForDate(charge, debitExchangeRates).eventAmountILS
      : null;

    // entryForAccounting setup
    const entryForAccounting: Partial<EntryForAccounting> = {};

    entryForAccounting.movementType = null;

    entryForAccounting.creditAccount = charge.tax_category;
    entryForAccounting.debitAccount = charge.financial_entity;

    entryForAccounting.creditAmount = entryForAccounting.debitAmount = charge.tax_invoice_amount
      ? parseFloat(charge.tax_invoice_amount)
      : chargeAmount;

    entryForAccounting.creditAmountILS = entryForAccounting.debitAmountILS = getILSForDate(
      charge,
      charge.account_type == 'creditcard' ? debitExchangeRates : invoiceExchangeRates
    ).eventAmountILS;

    if (charge.vatAfterDiduction && charge.vatAfterDiduction != 0) {
      entryForAccounting.secondAccountCreditAmount = charge.vatAfterDiduction;
      entryForAccounting.secondAccountCreditAmountILS = getILSForDate(charge, debitExchangeRates).vatAfterDiductionILS;
      entryForAccounting.creditAmount = charge.amountBeforeVAT;
      entryForAccounting.creditAmountILS = getILSForDate(charge, debitExchangeRates).amountBeforeVATILS;
      entryForAccounting.secondAccountDebitAmount = entryForAccounting.secondAccountDebitAmountILS = 0;
      entryForAccounting.movementType = hashVATIndexes.vatIncomesMovementTypeIndex;
      if (chargeAmount > 0) {
        entryForAccounting.creditAccount = hashVATIndexes.vatIncomesIndex;
      }
    } else if (charge.tax_category != 'אוריח') {
      entryForAccounting.movementType = hashVATIndexes.vatFreeIncomesMovementTypeIndex;

      if (chargeAmount > 0) {
        entryForAccounting.creditAccount = hashVATIndexes.vatFreeIncomesIndex;
      }
    }

    // more setup for both
    if (charge.tax_invoice_currency) {
      entryForFinancialAccount.creditAmountILS = entryForFinancialAccount.debitAmountILS = originalAmount;
    }
    entryForAccounting.reference2 = entryForFinancialAccount.reference2 = charge.bank_reference;
    entryForAccounting.reference1 = entryForFinancialAccount.reference1 = charge.tax_invoice_number;
    entryForAccounting.description = entryForFinancialAccount.description = charge.user_description;

    if (chargeAmount < 0) {
      swapObjectKeys(entryForAccounting, 'creditAccount', 'debitAccount');
      swapObjectKeys(entryForAccounting, 'creditAmount', 'debitAmount');
      swapObjectKeys(entryForAccounting, 'creditAmountILS', 'debitAmountILS');
      swapObjectKeys(entryForAccounting, 'secondAccountCreditAmount', 'secondAccountDebitAmount');
      swapObjectKeys(entryForAccounting, 'secondAccountCreditAmountILS', 'secondAccountDebitAmountILS');
      swapObjectKeys(entryForAccounting, 'reference1', 'reference2');
      swapObjectKeys(entryForFinancialAccount, 'creditAccount', 'debitAccount');
      swapObjectKeys(entryForFinancialAccount, 'creditAmount', 'debitAmount');
      swapObjectKeys(entryForFinancialAccount, 'creditAmountILS', 'debitAmountILS');
      swapObjectKeys(entryForFinancialAccount, 'reference1', 'reference2');
      if (charge.vatAfterDiduction && charge.vatAfterDiduction != 0) {
        charge.tax_category == 'פלאפון'
          ? (entryForAccounting.movementType = 'פלא')
          : charge.is_property
          ? (entryForAccounting.movementType = hashVATIndexes.vatExpensesPropertyMovementTypeIndex)
          : (entryForAccounting.movementType = hashVATIndexes.vatExpensesMovementTypeIndex);
      } else {
        entryForAccounting.movementType = null;
      }
    }

    console.log({
      entryForAccounting,
      entryForFinancialAccount,
    });

    return {
      entryForAccounting: entryForAccounting as EntryForAccounting,
      entryForFinancialAccount: entryForFinancialAccount as EntryForFinancialAccount,
    };
  };
}
