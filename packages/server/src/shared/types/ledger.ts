import type { IGetChargesByIdsResult } from '@modules/charges/types.js';
import type { IGetLedgerRecordsByChargesIdsResult } from '@modules/ledger/types.js';
import type { Currency, FinancialAmount } from '@shared/gql-types';

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
  creditAccountID1?: string;
  creditAccountID2?: string;
  debitAccountID1?: string;
  debitAccountID2?: string;
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
  ownerId: string;
  currencyRate?: number;
  chargeId: string;
}

export interface LedgerRecordsProto {
  records: IGetLedgerRecordsByChargesIdsResult[];
  charge: IGetChargesByIdsResult;
  balance?: LedgerBalanceInfoType;
  errors: string[];
}

export type StrictLedgerProto = Omit<LedgerProto, 'debitAccountID1' | 'creditAccountID1'> & {
  debitAccountID1: string;
  creditAccountID1: string;
};

export type LedgerBalanceUnbalancedEntityProto = {
  entityId: string;
  balance: FinancialAmount;
};

export type LedgerBalanceInfoType = {
  isBalanced: boolean;
  unbalancedEntities: Array<{ entityId: string; balance: FinancialAmount }>;
  balanceSum: number;
};

export type LedgerRecordDiffsProto = Partial<IGetLedgerRecordsByChargesIdsResult>;
