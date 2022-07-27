import { gql } from 'graphql-modules';

export const taxesSchema = gql`
  extend type Charge {
    " calculated field based on the actual ledger records, optional because not all charges has VAT "
    vat: FinancialAmount
    " withholding tax "
    withholdingTax: FinancialAmount
    " פחת, ציוד  "
    property: Boolean
  }
`;
