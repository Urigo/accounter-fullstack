import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    " The owner's annual company report (form 1214) for a tax year: its data, validation and the file to upload to SHAAM "
    report1214(ownerId: UUID, year: Int!): Report1214!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    " Tax years form 1214 can be generated for "
    report1214SupportedYears: [Int!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " The annual company report (form 1214) of an owner and tax year "
  type Report1214 {
    id: ID!
    " The reporting company "
    owner: Business!
    year: Int!
    " The stored form 1214 profile of the year (empty defaults when nothing is saved) "
    profile: Report1214Profile!
    " The shareholders of the year, in report order "
    shareholders: [Shareholder!]!
    " Issues found while building the report from the books and the profile, and the form's validation rules "
    validation: Report1214Validation!
    " The file to upload to SHAAM. Null (with a REPORT_1214_VALIDATION_FAILED error) while validation has errors, so the other fields still resolve "
    file: Report1214File
  }

  " Result of validating a form 1214 report "
  type Report1214Validation {
    " Whether the report has no error (warnings do not block the file) "
    isValid: Boolean!
    errors: [Report1214Issue!]!
    warnings: [Report1214Issue!]!
  }

  " Severity of a form 1214 issue "
  enum Report1214IssueSeverity {
    " Blocks the file "
    ERROR
    " Does not block the file, but should be reviewed before filing "
    WARNING
  }

  " A single form 1214 issue "
  type Report1214Issue {
    " Stable rule ID: a generator rule (e.g. shareholders.dividendRights.total), or accounter.* for data missing from the books or the profile "
    ruleId: String!
    severity: Report1214IssueSeverity!
    message: String!
    " Where the issue is, as a path into the report input (e.g. company.phone, shareholders[0].fullName); null for report-level issues "
    path: String
    " The record 1000 / appendix code the issue is about, when it is about one "
    code: String
    " The record type (1000, 1020, ...) the issue is about, when known "
    recordType: String
    " 0-based index of the record among the records of its type, when known "
    recordIndex: Int
    " Page (and note) of the SHAAM layout specification the rule comes from; null for accounter.* issues "
    specRef: String
  }

  " The form 1214 file to upload to SHAAM "
  type Report1214File {
    id: ID!
    " Suggested file name, 1214_<file number>_<tax year>.txt "
    fileName: String!
    " The file, Windows-1255 encoded, as base64 "
    encodedContent: String!
    " Warnings of the generated report "
    warnings: [Report1214Issue!]!
    " Codes with a 0 amount left out of the file (a 0 is written only for codes that allow it) "
    omittedZeroCodes: [Report1214OmittedZeroCode!]!
  }

  " A code-amount entry with a 0 amount that the file leaves out "
  type Report1214OmittedZeroCode {
    " The record type (1000, 2000, 30xx, ...) "
    record: String!
    " 0-based index of the record among the records of its type "
    recordIndex: Int!
    code: String!
  }
`;
