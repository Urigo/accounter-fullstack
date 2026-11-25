import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    " The owner's form 1214 profile for a tax year: what the books cannot supply. Empty defaults when nothing is stored yet "
    report1214Profile(ownerId: UUID, year: Int!): Report1214Profile!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  extend type Mutation {
    " Updates the owner's form 1214 profile for a tax year. Each block of the input is optional: an omitted block is kept, a provided block replaces the stored one, and null clears it "
    updateReport1214Profile(
      ownerId: UUID
      year: Int!
      input: Report1214ProfileInput!
    ): Report1214Profile! @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " The user-entered data of the annual company report (form 1214) of an owner and tax year "
  type Report1214Profile {
    id: ID!
    ownerId: UUID!
    year: Int!
    " Overrides and extras for the company identity the books lack "
    company: Report1214CompanyOverrides!
    " The yes/no and flag declarations of record 1000; every member may still be unset "
    declarations: Report1214Declarations!
    " The person or office that helped fill in the report; null when none is stored "
    preparer: Report1214Preparer
    " Numbers of certificates attached to the report; null when none is stored "
    attachments: Report1214Attachments
    " A changed bank account to report; null when the account on file stays "
    bankAccount: Report1214BankAccount
    " Other taxable income in Israel and abroad; null when none is stored "
    otherTaxableIncome: Report1214OtherTaxableIncome
    " Capital-gains appendices, transmitted and not; null when none is stored "
    capitalGainsSummary: Report1214CapitalGainsSummary
    " Purchase of a qualifying company (part A of the form); null when none is stored "
    qualifyingCompany: Report1214QualifyingCompany
    " Related companies in Israel or abroad (records 1010). The form allows 3; the report validation reports more "
    relatedCompanies: [Report1214RelatedCompany!]!
    " Investments in R&D companies (records 1030). The form allows 5; the report validation reports more "
    rdInvestments: [Report1214RdInvestment!]!
    " Record 1000 amounts entered by hand, by code; they win over computed amounts "
    amountOverrides: [Report1214AmountOverride!]!
    " When the profile was last saved; null when nothing is stored yet "
    updatedAt: DateTime
  }

  " A phone or fax number "
  type Report1214Phone {
    " One of the prefixes form 1214 allows (02, 03, 04, 08, 09, 05x, 07x) "
    prefix: String!
    " Exactly 7 digits "
    number: String!
  }

  " Company identity overrides and extras; unset members come from the books "
  type Report1214CompanyOverrides {
    " Registered name, overriding the business name "
    registeredName: String
    phone: Report1214Phone
    fax: Report1214Phone
    email: String
    occupationDescription: String
    mailingAddress: String
    businessAddress: String
    " Where the books are kept "
    booksAddress: String
    " Withholding file number, overriding the one on the admin business "
    withholdingFileNumber: String
  }

  " Whether the company must file form 6111 (field 834) "
  enum Report1214Form6111Obligation {
    OBLIGED
    NOT_OBLIGED
    NOT_RELEVANT
  }

  " Consolidated report status (field 875) "
  enum Report1214ConsolidatedReport {
    CONSOLIDATED_UNDER_SECTION_23
    CONSOLIDATES_WITH_PARENT
    NOT_RELEVANT
  }

  " How a related company relates to the reporting company (record 1010) "
  enum Report1214RelatedCompanyRelationType {
    PARENT
    SUBSIDIARY
    PARTNERSHIP
    KIBBUTZ_RELATED_CORPORATION
    JOINTLY_CONTROLLED
    GRANDDAUGHTER
    GRANDMOTHER
    OTHER
  }

  " A family company and its representative (fields 836-837) "
  type Report1214FamilyCompany {
    " Up to 9 digits "
    representativeFileNumber: String!
  }

  " A beneficiary enterprise (fields 851-852) "
  type Report1214BeneficiaryEnterprise {
    noticeDate: TimelessDate!
  }

  " A special (non-calendar) tax year (fields 863-864) "
  type Report1214SpecialYear {
    balanceSheetDate: TimelessDate!
  }

  " Declarations of record 1000. All members are nullable: the report validation names the missing required ones "
  type Report1214Declarations {
    " 878, required "
    hasTaxPlanningAction: Boolean
    " 879, required "
    hadRelatedPartyTransactions: Boolean
    " 880, required "
    controlsBodyOfPersons: Boolean
    " 881, required "
    holdsRightsInBodyOfPersons: Boolean
    " 882, required "
    appliesAccountingStandards: Boolean
    " 1029, required "
    directorsReceivedOpinion: Boolean
    " 1030, required "
    tookReportablePosition: Boolean
    " 1034-1046: reportable position numbers (form 1346); the form allows 5 "
    reportablePositions: [Int!]
    " 834 "
    form6111Obligation: Report1214Form6111Obligation
    " 835 "
    financialStatementsAttached: Boolean
    " 836-837 "
    familyCompany: Report1214FamilyCompany
    " 846 "
    isHouseCompany: Boolean
    " 847 "
    form1343Attached: Boolean
    " 848 "
    form1344Attached: Boolean
    " 849 "
    claimsCapitalInvestmentLawBenefits: Boolean
    " 850 "
    preferredEnterprise: Boolean
    " 851-852 "
    beneficiaryEnterprise: Report1214BeneficiaryEnterprise
    " 862 "
    dividendDistributed: Boolean
    " 863-864 "
    specialYear: Report1214SpecialYear
    " 874 "
    foreignInvestors: Boolean
    " 875 "
    consolidatedReport: Report1214ConsolidatedReport
    " 876 "
    partnerInPartnership: Boolean
    " 877 "
    isKibbutz: Boolean
    " 883 "
    requestsAdvancePayments: Boolean
    " 884 "
    hasBuildingIncome: Boolean
    " 886 "
    isTrustBeneficiary: Boolean
    " 1031 "
    nonDeductibleSalaryExpenses: Boolean
    " 1032 "
    fewMembersCompany62A: Boolean
    " 1033 "
    partOfMultinationalGroup: Boolean
    " 1064 "
    noBankAccount: Boolean
    " 833: forces yes when capital-gains appendices exist but none is transmitted "
    hasCapitalGainsAppendix: Boolean
  }

  " The person or office that helped fill in the report (fields 563-831) "
  type Report1214Preparer {
    officeName: String
    contactName: String
    name: String
    profession: String
    " Up to 9 digits "
    licensedDealerNumber: String
    address: String
    phone: Report1214Phone
  }

  " Numbers of certificates attached to the report (fields 954-959) "
  type Report1214Attachments {
    " Donation receipts for code 070 "
    donationReceiptsCount: Int
    " Withholding certificates for code 010 "
    withholdingCertificatesCount: Int
  }

  " A changed bank account (codes 277, 278, 280) "
  type Report1214BankAccount {
    " Exactly 2 digits "
    bank: String!
    " Exactly 3 digits "
    branch: String!
    " 1 to 9 digits "
    account: String!
  }

  " Other taxable income in Israel and abroad (fields 887-953) "
  type Report1214OtherTaxableIncome {
    source: String
    amount: Float
    ratePercent: Float
  }

  " Why capital-gains appendices were not transmitted (fields 964-968) "
  type Report1214CapitalGainsReasons {
    lossOrNoGain: Boolean
    overFiveImprovementBalances: Boolean
    over14Appendices: Boolean
    other: Boolean
    otherText: String
  }

  " Capital-gains appendices, transmitted and not (fields 960-1017) "
  type Report1214CapitalGainsSummary {
    totalAppendicesCount: Int
    untransmittedCount: Int
    reasons: Report1214CapitalGainsReasons
  }

  " Purchase of a qualifying company (fields 1065-1102) "
  type Report1214QualifyingCompany {
    purchased: Boolean
    israeliPurchaseAmount: Float
    foreignPurchaseAmount: Float
    amortizationClaimed: Boolean
    amortizationAmount: Float
  }

  " A related company in Israel or abroad (record 1010) "
  type Report1214RelatedCompany {
    companyName: String!
    " 1 to 9 digits "
    companyFileNumber: String
    relationType: Report1214RelatedCompanyRelationType!
    " Assessing office of the company's file "
    assessingOfficeCode: Int
  }

  " An investment in an R&D company (record 1030) "
  type Report1214RdInvestment {
    companyName: String!
    " 1 to 9 digits "
    companyFileNumber: String
    investmentAmount: Float!
  }

  " A record 1000 amount entered by hand "
  type Report1214AmountOverride {
    " 3-digit record 1000 code "
    code: String!
    " The amount. 0 is kept: for a code that does not allow zero, the report then leaves the code out "
    amount: Float!
  }

  " Profile blocks to save: omit a block to keep it, pass null to clear it, pass a value to replace it "
  input Report1214ProfileInput {
    company: Report1214CompanyOverridesInput
    declarations: Report1214DeclarationsInput
    preparer: Report1214PreparerInput
    attachments: Report1214AttachmentsInput
    bankAccount: Report1214BankAccountInput
    otherTaxableIncome: Report1214OtherTaxableIncomeInput
    capitalGainsSummary: Report1214CapitalGainsSummaryInput
    qualifyingCompany: Report1214QualifyingCompanyInput
    " The form allows 3 (the report validation reports more); at most 50 are stored "
    relatedCompanies: [Report1214RelatedCompanyInput!]
    " The form allows 5 (the report validation reports more); at most 50 are stored "
    rdInvestments: [Report1214RdInvestmentInput!]
    " Record 1000 input codes of the tax year, each at most once; derived codes are refused "
    amountOverrides: [Report1214AmountOverrideInput!]
  }

  " A phone or fax number "
  input Report1214PhoneInput {
    " One of the prefixes form 1214 allows (02, 03, 04, 08, 09, 05x, 07x) "
    prefix: String!
    " Exactly 7 digits "
    number: String!
  }

  " Company identity overrides and extras; empty strings are stored as unset "
  input Report1214CompanyOverridesInput {
    registeredName: String
    phone: Report1214PhoneInput
    fax: Report1214PhoneInput
    email: String
    occupationDescription: String
    mailingAddress: String
    businessAddress: String
    booksAddress: String
    " 1 to 9 digits "
    withholdingFileNumber: String
  }

  " A family company and its representative "
  input Report1214FamilyCompanyInput {
    " 1 to 9 digits "
    representativeFileNumber: String!
  }

  " A beneficiary enterprise "
  input Report1214BeneficiaryEnterpriseInput {
    noticeDate: TimelessDate!
  }

  " A special (non-calendar) tax year "
  input Report1214SpecialYearInput {
    balanceSheetDate: TimelessDate!
  }

  " Declarations of record 1000; unset members are stored as unset "
  input Report1214DeclarationsInput {
    hasTaxPlanningAction: Boolean
    hadRelatedPartyTransactions: Boolean
    controlsBodyOfPersons: Boolean
    holdsRightsInBodyOfPersons: Boolean
    appliesAccountingStandards: Boolean
    directorsReceivedOpinion: Boolean
    tookReportablePosition: Boolean
    " Position numbers, 1-999 each. The form allows 5 (the report validation reports more); at most 50 are stored "
    reportablePositions: [Int!]
    form6111Obligation: Report1214Form6111Obligation
    financialStatementsAttached: Boolean
    familyCompany: Report1214FamilyCompanyInput
    isHouseCompany: Boolean
    form1343Attached: Boolean
    form1344Attached: Boolean
    claimsCapitalInvestmentLawBenefits: Boolean
    preferredEnterprise: Boolean
    beneficiaryEnterprise: Report1214BeneficiaryEnterpriseInput
    dividendDistributed: Boolean
    specialYear: Report1214SpecialYearInput
    foreignInvestors: Boolean
    consolidatedReport: Report1214ConsolidatedReport
    partnerInPartnership: Boolean
    isKibbutz: Boolean
    requestsAdvancePayments: Boolean
    hasBuildingIncome: Boolean
    isTrustBeneficiary: Boolean
    nonDeductibleSalaryExpenses: Boolean
    fewMembersCompany62A: Boolean
    partOfMultinationalGroup: Boolean
    noBankAccount: Boolean
    hasCapitalGainsAppendix: Boolean
  }

  " The person or office that helped fill in the report; empty strings are stored as unset "
  input Report1214PreparerInput {
    officeName: String
    contactName: String
    name: String
    profession: String
    " 1 to 9 digits "
    licensedDealerNumber: String
    address: String
    phone: Report1214PhoneInput
  }

  " Numbers of certificates attached to the report "
  input Report1214AttachmentsInput {
    " Non-negative integer "
    donationReceiptsCount: Int
    " Non-negative integer "
    withholdingCertificatesCount: Int
  }

  " A changed bank account to report "
  input Report1214BankAccountInput {
    " Exactly 2 digits "
    bank: String!
    " Exactly 3 digits "
    branch: String!
    " 1 to 9 digits "
    account: String!
  }

  " Other taxable income in Israel and abroad "
  input Report1214OtherTaxableIncomeInput {
    source: String
    amount: Float
    ratePercent: Float
  }

  " Why capital-gains appendices were not transmitted "
  input Report1214CapitalGainsReasonsInput {
    lossOrNoGain: Boolean
    overFiveImprovementBalances: Boolean
    over14Appendices: Boolean
    other: Boolean
    otherText: String
  }

  " Capital-gains appendices, transmitted and not "
  input Report1214CapitalGainsSummaryInput {
    " Non-negative integer "
    totalAppendicesCount: Int
    " Non-negative integer "
    untransmittedCount: Int
    reasons: Report1214CapitalGainsReasonsInput
  }

  " Purchase of a qualifying company "
  input Report1214QualifyingCompanyInput {
    purchased: Boolean
    israeliPurchaseAmount: Float
    foreignPurchaseAmount: Float
    amortizationClaimed: Boolean
    amortizationAmount: Float
  }

  " A related company in Israel or abroad "
  input Report1214RelatedCompanyInput {
    companyName: String!
    " 1 to 9 digits "
    companyFileNumber: String
    relationType: Report1214RelatedCompanyRelationType!
    " Non-negative integer "
    assessingOfficeCode: Int
  }

  " An investment in an R&D company "
  input Report1214RdInvestmentInput {
    companyName: String!
    " 1 to 9 digits "
    companyFileNumber: String
    investmentAmount: Float!
  }

  " A record 1000 amount entered by hand "
  input Report1214AmountOverrideInput {
    " 3-digit record 1000 code "
    code: String!
    " The amount. 0 is meaningful: for a code that does not allow zero, it suppresses the code in the report "
    amount: Float!
  }
`;
