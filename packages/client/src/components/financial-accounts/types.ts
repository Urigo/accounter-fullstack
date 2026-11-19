import type { Currency, FinancialAccountType } from '@/gql/graphql.js';
import type { SettlementAccountSuggestionValue } from './settlement-account-suggestion.js';

export interface CurrencyTaxCategory {
  currency: Currency;
  taxCategory: { id: string; name: string };
}

export interface FinancialAccount {
  id: string;
  name: string;
  number: string;
  isBusiness?: boolean;
  type: FinancialAccountType;
  currencies?: CurrencyTaxCategory[];
  // Bank-specific fields
  bankNumber?: number;
  branchNumber?: number;
  iban?: string;
  swiftCode?: string;
  extendedBankNumber?: number;
  partyPreferredIndication?: number;
  partyAccountInvolvementCode?: number;
  accountDealDate?: number;
  accountUpdateDate?: number;
  metegDoarNet?: number;
  kodHarshaatPeilut?: number;
  accountClosingReasonCode?: number;
  accountAgreementOpeningDate?: number;
  serviceAuthorizationDesc?: string;
  branchTypeCode?: number;
  mymailEntitlementSwitch?: number;
  productLabel?: string;
  // Credit-card-specific fields
  /** The bank account the card is debited from */
  settlementAccountId?: string | null;
  /** The bank account the card's linked debits mostly come from, when no settlement account is set */
  suggestedSettlementAccount?: SettlementAccountSuggestionValue | null;
}
