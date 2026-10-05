import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    vatReport(filters: VatReportFilter): VatReportResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
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
    " month totals as filed in the PCN874 header, in local currency. Covers the whole month: chargesType does not apply "
    summary: VatReportSummary!
  }

  " monthly VAT report totals, matching the PCN874 file header "
  type VatReportSummary {
    " total taxable sales, excluding VAT (S1 and L1 records with VAT) "
    taxableSalesAmount: FinancialAmount!
    " total VAT on taxable sales "
    taxableSalesVat: FinancialAmount!
    " number of sales records the header counts "
    salesRecordCount: Int!
    " total zero-value / exempt sales (L2 records and L1 records without VAT) "
    zeroValOrExemptSalesAmount: FinancialAmount!
    " total VAT on non-equipment inputs "
    otherInputsVat: FinancialAmount!
    " total VAT on equipment (property) inputs "
    equipmentInputsVat: FinancialAmount!
    " number of input records the header counts "
    inputsCount: Int!
    " VAT to pay (positive) or receive (negative): taxableSalesVat - otherInputsVat - equipmentInputsVat "
    totalVat: FinancialAmount!
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
    allocationNumber: String
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
    recordType: Pcn874RecordType!
    isProperty: Boolean!
  }
`;
