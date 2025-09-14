import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    vatReport(filters: VatReportFilter): VatReportResult! @auth(role: ACCOUNTANT)
  }

  " input variables for vatReportRecords "
  input VatReportFilter {
    monthDate: TimelessDate!
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
    chargeAccountantStatus: AccountantStatus
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
