import { type ReactNode } from 'react';
import { BadgeQuestionMark, Bitcoin, Building2, CreditCard } from 'lucide-react';
import { FinancialAccountType } from '@/gql/graphql.js';

export const getAccountIcon = (type: FinancialAccountType): ReactNode => {
  switch (type) {
    case FinancialAccountType.BankAccount:
      return <Building2 className="h-5 w-5" />;
    case FinancialAccountType.CreditCard:
      return <CreditCard className="h-5 w-5" />;
    case FinancialAccountType.CryptoWallet:
      return <Bitcoin className="h-5 w-5" />;
    case FinancialAccountType.BankDepositAccount:
      return <Building2 className="h-5 w-5" />;
    case FinancialAccountType.ForeignSecurities:
      return <Building2 className="h-5 w-5" />;
    default:
      return <BadgeQuestionMark className="h-5 w-5" />;
  }
};

export const getAccountTypeLabel = (type: FinancialAccountType): string => {
  switch (type) {
    case FinancialAccountType.BankAccount:
      return 'Bank Account';
    case FinancialAccountType.CreditCard:
      return 'Credit Card';
    case FinancialAccountType.CryptoWallet:
      return 'Crypto Wallet';
    case FinancialAccountType.BankDepositAccount:
      return 'Bank Deposit Account';
    case FinancialAccountType.ForeignSecurities:
      return 'Foreign Securities';
    default:
      return 'Unknown Account Type';
  }
};
