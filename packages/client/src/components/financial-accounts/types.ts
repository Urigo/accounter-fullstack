import type { Currency, FinancialAccountType } from '@/gql/graphql.js';

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
  extendedBankNumber?: number;
  partyPreferredIndication?: number;
  partyAccountInvolvementCode?: number;
  accountDealDate?: number;
  accountUpdateDate?: number;
  metegDoarNet?: number;
  kodHarshaatPeilut?: number;
  accountClosingReasonCode?: number;
  accountAgreementOpeningDate?: number;
  serviceAuthorizationDesc?: number;
  branchTypeCode?: number;
  mymailEntitlementSwitch?: number;
  productLabel?: number;
}
