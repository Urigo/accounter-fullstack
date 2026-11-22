import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    " assets activated on or before the date that still have cost on the books "
    depreciationRecords(activeOn: TimelessDate!): [DepreciationRecord!]! @requiresAuth
    " computes a disposal without saving it "
    previewDepreciationDisposal(
      input: InsertDepreciationDisposalInput!
    ): PreviewDepreciationDisposalResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  extend type Mutation {
    insertDepreciationDisposal(
      input: InsertDepreciationDisposalInput!
    ): InsertDepreciationDisposalResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateDepreciationDisposal(
      input: UpdateDepreciationDisposalInput!
    ): UpdateDepreciationDisposalResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    deleteDepreciationDisposal(id: UUID!): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  extend type DepreciationRecord {
    disposals: [DepreciationDisposal!]!
    " cost still on the books after all disposals "
    remainingCost: FinancialAmount!
  }

  extend type CommonCharge {
    " disposals of depreciated assets this charge carries the money for "
    depreciationDisposals: [DepreciationDisposal!]!
  }

  extend type ChargeMetadata {
    depreciationDisposalsCount: Int!
  }

  " how an asset (or part of it) left the books "
  enum DepreciationDisposalType {
    " sold "
    SALE
    " part of the cost was refunded by the supplier; treated as a partial sale for the refunded amount "
    COST_REFUND
    " scrapped, lost or stolen, with no proceeds "
    WRITE_OFF
  }

  " a disposal of a depreciated asset "
  type DepreciationDisposal {
    id: UUID!
    depreciationRecord: DepreciationRecord!
    " the charge carrying the sale or refund; null for a write-off booked by the yearly depreciation charge "
    charge: Charge
    type: DepreciationDisposalType!
    disposalDate: TimelessDate!
    " part of the asset cost that leaves the books, excluding VAT "
    disposedCost: FinancialAmount!
    " consideration for the disposed part, excluding VAT "
    proceeds: FinancialAmount!
    description: String
    " depreciation accumulated on the disposed part up to the disposal date "
    accumulatedDepreciation: FinancialAmount!
    netBookValue: FinancialAmount!
    " proceeds minus net book value: positive is a gain, negative a loss "
    gainLoss: FinancialAmount!
  }

  " computed values of a disposal "
  type DepreciationDisposalComputation {
    disposedCost: FinancialAmount!
    proceeds: FinancialAmount!
    accumulatedDepreciation: FinancialAmount!
    netBookValue: FinancialAmount!
    gainLoss: FinancialAmount!
    " cost still on the books after this disposal "
    remainingCost: FinancialAmount!
  }

  " input variables for insertDepreciationDisposal "
  input InsertDepreciationDisposalInput {
    depreciationRecordId: UUID!
    chargeId: UUID
    type: DepreciationDisposalType!
    disposalDate: TimelessDate!
    disposedCost: Float!
    " defaults to disposedCost for COST_REFUND and to 0 for WRITE_OFF "
    proceeds: Float
    description: String
  }

  " input variables for updateDepreciationDisposal "
  input UpdateDepreciationDisposalInput {
    id: UUID!
    " pass null to unlink the charge "
    chargeId: UUID
    type: DepreciationDisposalType
    disposalDate: TimelessDate
    disposedCost: Float
    proceeds: Float
    description: String
  }

  " result type for insertDepreciationDisposal "
  union InsertDepreciationDisposalResult = DepreciationDisposal | CommonError

  " result type for updateDepreciationDisposal "
  union UpdateDepreciationDisposalResult = DepreciationDisposal | CommonError

  " result type for previewDepreciationDisposal "
  union PreviewDepreciationDisposalResult = DepreciationDisposalComputation | CommonError
`;
