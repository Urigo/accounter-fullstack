import type { Currency, TaxCategory } from '@shared/gql-types';

export interface EntryForFinancialAccount {
  creditAccount: string | null;
  debitAccount: string | null;
  creditAmount: number;
  debitAmount: number;
  creditAmountILS: number | null;
  debitAmountILS: number | null;
  reference1: string | null;
  reference2: string | null;
  description: string | null;
}

export interface EntryForAccounting {
  movementType: string | null;
  creditAccount: string | null;
  debitAccount: string | null;
  creditAmount: number | null;
  debitAmount: number | null;
  creditAmountILS: number;
  debitAmountILS: number;
  secondAccountCreditAmount?: number;
  secondAccountCreditAmountILS?: number;
  secondAccountDebitAmount?: number;
  secondAccountDebitAmountILS?: number;
  reference1: string | null;
  reference2: string | null;
  description: string | null;
}

export interface LedgerProto {
  id: string;
  creditAccountID1: string | TaxCategory;
  creditAccountID2?: string | TaxCategory;
  debitAccountID1: string | TaxCategory;
  debitAccountID2?: string | TaxCategory;
  creditAmount1?: number;
  creditAmount2?: number;
  debitAmount1?: number;
  debitAmount2?: number;
  localCurrencyCreditAmount1: number;
  localCurrencyCreditAmount2?: number;
  localCurrencyDebitAmount1: number;
  localCurrencyDebitAmount2?: number;
  description?: string;
  invoiceDate: Date;
  reference1?: string;
  valueDate: Date;
  currency: Currency;
  isCreditorCounterparty: boolean;
}
