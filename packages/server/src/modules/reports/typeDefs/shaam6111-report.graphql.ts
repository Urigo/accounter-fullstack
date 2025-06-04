import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    shaam6111(year: Int!, businessId: UUID): Shaam6111Report! @auth(role: ACCOUNTANT)
    shaam6111ByYear(businessId: UUID, fromYear: Int!, toYear: Int!): [Shaam6111Report!]!
      @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    updateShaam6111(businessId: UUID, year: Int!, content: String!): Boolean!
      @auth(role: ACCOUNTANT)
  }

  " record of Shaam6111 report "
  type Shaam6111Report {
    id: ID!
    business: Business!
    year: Int!
    file: Shaam6111File!
    data: Shaam6111Data!
  }

  " Shaam6111 file content "
  type Shaam6111File {
    id: ID!
    reportContent: String!
    diffContent: String
    fileName: String!
  }

  " Shaam6111 report data "
  type Shaam6111Data {
    id: ID!
    header: Shaam6111Header!
    profitAndLoss: [Shaam6111ReportEntry!]!
    taxAdjustment: [Shaam6111ReportEntry!]!
    balanceSheet: [Shaam6111ReportEntry!]
    individualOrCompany: IndividualOrCompany
  }

  " Business type enum (סוג עסק) "
  enum IndividualOrCompany {
    "Individual (יחיד)"
    INDIVIDUAL
    "Company (חברה)"
    COMPANY
  }

  " Business type enum (סוג עסק) "
  enum BusinessType {
    "Industrial (תעשייתי)"
    INDUSTRIAL
    "Commercial (מסחרי)"
    COMMERCIAL
    "Service providers (נותני שירותים)"
    SERVICE
    "Report includes more than one business (הדוח כולל יותר מעסק אחד)"
    MULTIPLE
  }

  " Reporting method enum (שיטת דיווח) "
  enum ReportingMethod {
    "Cash basis (מזומן)"
    CASH
    "Accrual basis (מצטבר)"
    ACCRUAL
    "According to dollar regulations (לפי תקנות דולריות)"
    DOLLAR_REGULATIONS
  }

  " Accounting method enum (שיטת חשבונאות) "
  enum AccountingMethod {
    "Single-entry (חד צידית)"
    SINGLE_ENTRY
    "Double-entry (כפולה)"
    DOUBLE_ENTRY
  }

  " Business accounting system enum (הנח''ש של העסק) "
  enum AccountingSystem {
    "Manual (ידני)"
    MANUAL
    "Computerized (ממוחשב)"
    COMPUTERIZED
  }

  " IFRS reporting option enum (דווח בחלופה - יישום תקני חשבונאות) "
  enum IFRSReportingOption {
    "Option 1 (חלופה 1)"
    OPTION_1
    "Accounting adjustments for those who implemented Option 2 per directive 7/2010 (התאמות חשבונאיות למי שיישם את חלופה 2 בהוראת ביצוע 7/2010)"
    OPTION_2_ADJUSTMENTS
    "Accounting adjustments for those who implemented Option 3 per directive 7/2010 (התאמות חשבונאיות למי שיישם את חלופה 3 בהוראת ביצוע 7/2010)"
    OPTION_3_ADJUSTMENTS
    "No IFRS implementation (במידה ואין יישום תקני חשבונאות)"
    NONE
  }

  " Currency reporting type enum (דיווח מטבע) "
  enum CurrencyType {
    "Amounts in shekels (הסכומים בשקלים)"
    SHEKELS
    "Amounts in dollars (הסכומים בדולרים)"
    DOLLARS
  }

  " Audit opinion type enum (חוות דעת) "
  enum AuditOpinionType {
    "Unqualified opinion (נוסח אחיד (בלתי מסוייג))"
    UNQUALIFIED
    "Unqualified opinion with emphasis on going concern (בנוסח אחיד עם הפניית תשומת לב להערת עסק חי)"
    UNQUALIFIED_WITH_GOING_CONCERN
    "Unqualified opinion with other emphases (בנוסח אחיד עם הפניות תשומת לב אחרת)"
    UNQUALIFIED_WITH_OTHER_EMPHASES
    "Qualified opinion (הסתייגות)"
    QUALIFIED
    "Adverse opinion (שלילית)"
    ADVERSE
    "Disclaimer of opinion (המנעות)"
    DISCLAIMER
    "No audit opinion (אין חוות דעת)"
    NONE
  }

  " Header Record containing metadata about the tax report (כותרת)"
  type Shaam6111Header {
    "Tax file number (9 digits) - mandatory field (מספר תיק)"
    taxFileNumber: String!
    "Tax year (4 digits) - mandatory field (שנת מס)"
    taxYear: String!
    "ID number or company registration number (9 digits) - mandatory field (מס' זהות/ח.פ)"
    idNumber: String!
    "VAT file number (9 digits) - if exists (מס' תיק מע''מ)"
    vatFileNumber: String
    "Withholding tax file number (9 digits) - if exists (מס' תיק ניכויים)"
    withholdingTaxFileNumber: String
    "Industry code (4 digits) - mandatory field (מס' ענף)"
    industryCode: String!
    "Business description (50 characters max) - right-aligned Hebrew text (תאור העסק)"
    businessDescription: String
    "Business type - mandatory field (סוג עסק)"
    businessType: BusinessType!
    "Reporting method - mandatory field (שיטת דיווח)"
    reportingMethod: ReportingMethod!
    "Accounting method - mandatory field (שיטת חשבונאות)"
    accountingMethod: AccountingMethod!
    " Business accounting system - mandatory field (הנח''ש של העסק) "
    accountingSystem: AccountingSystem!
    "Is this report for a partnership (דוח זה בגין שותפות)"
    isPartnership: Boolean
    "Profit and Loss statement included - mandatory field (מצורף דוח רווח הפסד)"
    includesProfitLoss: Boolean!
    "Tax adjustment statement included - mandatory field (מצורף דוח התאמה)"
    includesTaxAdjustment: Boolean!
    "Balance sheet included - mandatory field (מצורף דוח מאזן)"
    includesBalanceSheet: Boolean!
    "Number of entries in profit and loss section (3 digits) - mandatory field (מספר נגררות פיסקת רווח הפסד)"
    profitLossEntryCount: Int
    "Number of entries in tax adjustment section (3 digits) - mandatory if entries exist (מספר נגררות פיסקת התאמה למס)"
    taxAdjustmentEntryCount: Int
    "Number of entries in balance sheet section (3 digits) - mandatory if entries exist (מספר נגררות פיסקת מאזן)"
    balanceSheetEntryCount: Int
    " Year when IFRS accounting standards were implemented (4 digits) (שנת מס - יישום תקני חשבונאות) Starting from 2006, or 9999 if not applicable "
    ifrsImplementationYear: String
    "IFRS reporting option (דווח בחלופה - יישום תקני חשבונאות)"
    ifrsReportingOption: IFRSReportingOption
    "Software registration certificate number (8 digits) - 99999999 if not applicable (מספר תעודת רישום - חייב ברישום תוכנה)"
    softwareRegistrationNumber: String
    "For partnership reports: number of partners (3 digits) - 999 if not applicable (דוח זה בגין שותפות: מספר השותפים)"
    partnershipCount: Int
    "For partnership reports: share in partnership profits (6 digits, 2 decimal places) - 999999 if not applicable (דוח זה בגין שותפות: חלקי ברווחי השותפות)"
    partnershipProfitShare: Int
    "Currency reporting type (דיווח מטבע)"
    currencyType: CurrencyType!
    "Audit opinion type (חוות דעת)"
    auditOpinionType: AuditOpinionType
    "Are amounts in thousands (הסכום באלפי שקלים/דולרים)"
    amountsInThousands: Boolean!
  }

  " Report Entry interface representing a single financial data entry in any report section "
  type Shaam6111ReportEntry {
    code: Int!
    amount: Int!
    label: String!
  }
`;
