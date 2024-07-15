import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    vatReport(filters: VatReportFilter): VatReportResult! @auth(role: ACCOUNTANT)
  }

  " input variables for vatReportRecords "
  input VatReportFilter {
    fromDate: TimelessDate!
    toDate: TimelessDate!
    chargesType: ChargeFilterType
    financialEntityId: UUID!
  }

  " vat report result "
  type VatReportResult {
    expenses: [VatReportRecord!]!
    income: [VatReportRecord!]!
    missingInfo: [Charge!]!
    differentMonthDoc: [Charge!]!
    businessTrips: [Charge!]!
  }

  " Vat report record "
  type VatReportRecord {
    chargeAccountantReviewed: Boolean
    chargeId: UUID!
    documentId: UUID
    business: FinancialEntity
    vatNumber: String
    image: String
    documentSerial: String
    documentDate: TimelessDate
    chargeDate: TimelessDate
    amount: FinancialAmount!
    localAmount: FinancialAmount
    localVat: FinancialAmount
    foreignVat: FinancialAmount
    foreignVatAfterDeduction: FinancialAmount
    localVatAfterDeduction: FinancialAmount
    " Int value"
    roundedLocalVatAfterDeduction: FinancialIntAmount
    taxReducedLocalAmount: FinancialIntAmount
    taxReducedForeignAmount: FinancialIntAmount
  }
`;
