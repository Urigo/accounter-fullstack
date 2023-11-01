import type { Currency } from '@shared/gql-types';
import type { CounterAccountProto } from './index.js';

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
  creditAccountID1?: CounterAccountProto;
  creditAccountID2?: CounterAccountProto;
  debitAccountID1?: CounterAccountProto;
  debitAccountID2?: CounterAccountProto;
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
  reference2?: string;
  valueDate: Date;
  currency: Currency;
  isCreditorCounterparty: boolean;
  ownerId: string;
  currencyRate?: number;
}

export type StrictLedgerProto = Omit<LedgerProto, 'debitAccountID1' | 'creditAccountID1'> & {
  debitAccountID1: CounterAccountProto;
  creditAccountID1: CounterAccountProto;
};
