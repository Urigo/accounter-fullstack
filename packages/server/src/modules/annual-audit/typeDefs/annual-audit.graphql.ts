import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    annualAuditOpeningBalanceStatus(
      ownerId: UUID!
      year: Int!
    ): AnnualAuditOpeningBalanceStatusInfo!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])

    annualAuditStepStatuses(ownerId: UUID!, year: Int!): [AnnualAuditStepStatusInfo!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  extend type Mutation {
    setAnnualAuditStep03Status(input: SetAnnualAuditStep03StatusInput!): AnnualAuditStepStatusInfo!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    setAnnualAuditStep09Status(input: SetAnnualAuditStep09StatusInput!): AnnualAuditStepStatusInfo!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    setAnnualAuditStepStatus(input: SetAnnualAuditStepStatusInput!): AnnualAuditStepStatusInfo!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    setAnnualAuditWorkingTemplate(
      input: SetAnnualAuditWorkingTemplateInput!
    ): AnnualAuditStepStatusInfo!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " Report slot an annual audit dynamic report template serves "
  enum AnnualAuditReportType {
    BALANCE_SHEET
    PROFIT_AND_LOSS
  }

  " User type classification for annual audit opening balance step "
  enum AnnualAuditOpeningBalanceUserType {
    NEW
    MIGRATING
    CONTINUING
    ERROR
  }

  " Status values for annual audit steps "
  enum AnnualAuditStepStatus {
    COMPLETED
    IN_PROGRESS
    PENDING
    BLOCKED
  }

  " Result type for annualAuditOpeningBalanceStatus query "
  type AnnualAuditOpeningBalanceStatusInfo {
    id: ID!
    userType: AnnualAuditOpeningBalanceUserType!
    " Only relevant for MIGRATING users "
    balanceChargeId: UUID
    derivedStatus: AnnualAuditStepStatus!
    errorMessage: String
  }

  " Persisted manual status for a single annual audit step "
  type AnnualAuditStepStatusInfo {
    id: ID!
    ownerId: UUID!
    year: Int!
    stepId: String!
    status: AnnualAuditStepStatus!
    notes: String
    " JSON-encoded evidence metadata (step-specific structure) "
    evidence: String
    updatedAt: DateTime!
    completedAt: DateTime
  }

  " Input for setting Step 03 (opening balance) manual status "
  input SetAnnualAuditStep03StatusInput {
    ownerId: UUID!
    year: Int!
    status: AnnualAuditStepStatus!
    notes: String
  }

  " Input for setting Step 09 (save final dynamic report template) status "
  input SetAnnualAuditStep09StatusInput {
    ownerId: UUID!
    year: Int!
    " The name of the dynamic report template to lock as the final draft "
    templateName: String!
    " The report the template is locked for. Omitted = both Balance Sheet and Profit and Loss "
    reportType: AnnualAuditReportType
  }

  " Input for setting the working dynamic report template(s) of an annual audit (step 05) "
  input SetAnnualAuditWorkingTemplateInput {
    ownerId: UUID!
    year: Int!
    " The working template name. null clears the working template "
    templateName: String
    " The report the template is used for. Omitted = both Balance Sheet and Profit and Loss "
    reportType: AnnualAuditReportType
  }

  " Generic input for manually setting any annual audit step status "
  input SetAnnualAuditStepStatusInput {
    ownerId: UUID!
    year: Int!
    stepId: String!
    status: AnnualAuditStepStatus!
    notes: String
  }
`;
