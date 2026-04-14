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
  }
`;
