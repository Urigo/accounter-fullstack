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