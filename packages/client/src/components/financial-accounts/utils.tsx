import { type ReactNode } from 'react';
import { BadgeQuestionMark, Bitcoin, Building2, CreditCard } from 'lucide-react';
import type { FinancialAccountType } from '@/gql/graphql';

export const getAccountIcon = (type: FinancialAccountType): ReactNode => {
  switch (type) {
    case 'BANK_ACCOUNT':
      return <Building2 className="h-5 w-5" />;
    case 'CREDIT_CARD':
      return <CreditCard className="h-5 w-5" />;
    case 'CRYPTO_WALLET':
      return <Bitcoin className="h-5 w-5" />;
    default:
      return <BadgeQuestionMark className="h-5 w-5" />;
  }
};

export const getAccountTypeLabel = (type: FinancialAccountType): string => {
  switch (type) {
    case 'BANK_ACCOUNT':
      return 'Bank Account';
    case 'CREDIT_CARD':
      return 'Credit Card';
    case 'CRYPTO_WALLET':
      return 'Crypto Wallet';
    default:
      return 'Unknown Account Type';
  }
};
