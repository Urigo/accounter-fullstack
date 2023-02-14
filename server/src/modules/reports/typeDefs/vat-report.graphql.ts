import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    vatReport(filters: VatReportFilter): VatReportResult!
  }

  " input variables for vatReportRecords "
  input VatReportFilter {
    fromDate: TimelessDate!
    toDate: TimelessDate!
    financialEntityId: ID!
  }

  " vat report result "
  type VatReportResult {
    expenses: [VatReportRecord!]!
    income: [VatReportRecord!]!
    missingInfo: [Charge!]!
    differentMonthDoc: [Charge!]!
  }

  " Vat report record "
  type VatReportRecord {
    chargeId: ID!
    documentId: ID
    businessName: String
    vatNumber: String
    image: String
    documentSerial: String
    documentDate: TimelessDate
    chargeDate: TimelessDate
    amount: FinancialAmount!
    localAmount: FinancialAmount
    vat: FinancialAmount
    vatAfterDeduction: FinancialAmount
    localVatAfterDeduction: FinancialAmount
    " Int value"
    roundedLocalVatAfterDeduction: FinancialIntAmount
    taxReducedLocalAmount: FinancialAmount
  }
`;
