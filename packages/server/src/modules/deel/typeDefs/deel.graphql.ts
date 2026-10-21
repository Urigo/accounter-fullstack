import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    addDeelContract(
      contractId: ID!
      contractStartDate: TimelessDate!
      contractorId: UUID!
      contractorName: String!
      businessId: UUID!
    ): Boolean! @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
    fetchDeelDocuments: FetchDeelDocumentsResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  "Why part of a Deel sync was not saved"
  enum DeelSyncIssueCode {
    "The invoice's Deel contract is not linked to a business"
    UNKNOWN_CONTRACT
    "Payment breakdowns of the same contract disagree on the contractor details"
    INCONSISTENT_CONTRACT_INFO
    "The invoice matches several payment breakdowns"
    AMBIGUOUS_PAYMENT_MATCH
    "No charge exists or can be created for the receipt"
    MISSING_CHARGE
    "The invoice file could not be downloaded from Deel or stored"
    INVOICE_FILE_UNAVAILABLE
    "Another sync run saved the invoices in the meantime"
    ALREADY_PROCESSED
    "Saving to the database failed; nothing was saved for these invoices"
    PERSIST_FAILED
    "Saved, but a charge left empty could not be deleted"
    CLEANUP_FAILED
  }

  "A part of a Deel sync that was not saved, or saved with a warning"
  type DeelSyncIssue {
    code: DeelSyncIssueCode!
    "What went wrong, and what to do about it"
    message: String!
    "The Deel invoices affected"
    invoiceIds: [ID!]!
    "The Deel payment receipt affected, if any"
    receiptId: ID
    "The Deel contract involved, if any"
    contractId: ID
  }

  "Outcome of a Deel sync run"
  type DeelSyncResult {
    "Charges created or updated by this run"
    charges: [Charge!]!
    "Invoices that were not synced, and warnings"
    issues: [DeelSyncIssue!]!
  }

  "Result of a Deel sync — its outcome, or an error that stopped it before anything was saved"
  union FetchDeelDocumentsResult = DeelSyncResult | CommonError
`;
