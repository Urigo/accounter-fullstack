import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    " assets activated on or before the date that have an amount and still have cost on the books, including assets that are not depreciated (0% categories) "
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
    " cost still on the books after all disposals and cost refunds "
    remainingCost: FinancialAmount!
  }

  extend type CommonCharge {
    " disposals of depreciated assets this charge carries the money for "
    depreciationDisposals: [DepreciationDisposal!]!
  }

  extend type ChargeMetadata {
    depreciationDisposalsCount: Int!
  }

  " how an asset (or part of it) left the books, or how its cost was corrected "
  enum DepreciationDisposalType {
    " sold "
    SALE
    " part of the cost was refunded by the supplier: a correction to the cost, not a sale. It has no proceeds and no gain or loss; the depreciation it reverses is a depreciation correction (ordinary income) "
    COST_REFUND
    " scrapped, lost or stolen, with no proceeds "
    WRITE_OFF
  }

  " how a cost refund corrects the asset "
  enum DepreciationRefundMode {
    " the refund corrects the original price: the cost is reduced from activation. Years before the refund year stay as filed; the refund year reverses the depreciation booked on the refunded part (the recapture) and depreciates the corrected cost "
    FROM_ACTIVATION
    " a later rebate: the cost drops on the refund date and the accumulated depreciation stays, so the book value drops by the refund; only a refund above the book value gives income (the excess) "
    FROM_REFUND_DATE
  }

  " a disposal of a depreciated asset "
  type DepreciationDisposal {
    id: UUID!
    depreciationRecord: DepreciationRecord!
    " the charge carrying the sale or refund; null for a write-off booked by the yearly depreciation charge "
    charge: Charge
    type: DepreciationDisposalType!
    " how a cost refund corrects the asset; null for a sale or write-off "
    refundMode: DepreciationRefundMode
    disposalDate: TimelessDate!
    " part of the asset cost that leaves the books (the refunded amount for a cost refund), excluding VAT, in the local currency "
    disposedCost: FinancialAmount!
    " a cost refund of an asset recorded in a foreign currency, as entered in that currency; null otherwise "
    originalAmount: FinancialAmount
    " the rate originalAmount was converted to the local currency at; null when there is no originalAmount "
    exchangeRate: Float
    " consideration for a sale, excluding VAT; 0 for a write-off and a cost refund "
    proceeds: FinancialAmount!
    description: String
    " depreciation accumulated on the disposed part up to the disposal date; for a cost refund, the depreciation it reverses (the depreciation correction) "
    accumulatedDepreciation: FinancialAmount!
    " disposed cost minus accumulated depreciation "
    netBookValue: FinancialAmount!
    " proceeds minus net book value: positive is a gain, negative a loss; 0 for a cost refund "
    gainLoss: FinancialAmount!
    " cost removed by a cost refund; 0 for a sale or write-off "
    costReduction: FinancialAmount!
    " depreciation reversed by a cost refund, booked as ordinary income (the recapture, or the excess over book value); 0 for a sale or write-off "
    depreciationCorrection: FinancialAmount!
  }

  " computed values of a disposal or cost refund "
  type DepreciationDisposalComputation {
    disposedCost: FinancialAmount!
    " the rate a cost refund entered in the asset's currency is converted at; null otherwise "
    exchangeRate: Float
    proceeds: FinancialAmount!
    accumulatedDepreciation: FinancialAmount!
    netBookValue: FinancialAmount!
    gainLoss: FinancialAmount!
    costReduction: FinancialAmount!
    depreciationCorrection: FinancialAmount!
    " the asset's cost at the end of the event's year, after the event (its new cost) "
    remainingCost: FinancialAmount!
    " the asset's net book value at the end of the event's year, after the event "
    remainingBookValue: FinancialAmount!
  }

  " input variables for insertDepreciationDisposal "
  input InsertDepreciationDisposalInput {
    depreciationRecordId: UUID!
    chargeId: UUID
    type: DepreciationDisposalType!
    " COST_REFUND only; defaults to FROM_ACTIVATION "
    refundMode: DepreciationRefundMode
    disposalDate: TimelessDate!
    " the cost that leaves the books, in the local currency; for COST_REFUND, the refunded amount. Required, except for a COST_REFUND of an asset recorded in a foreign currency, which takes originalAmount instead "
    disposedCost: Float
    " COST_REFUND of an asset recorded in a foreign currency only, and required for it: the refunded amount in the asset's currency. It is converted at the asset's cost-basis rate (FROM_ACTIVATION) or at the refund charge's rate (FROM_REFUND_DATE) "
    originalAmount: Float
    " SALE only; a WRITE_OFF or COST_REFUND has no proceeds "
    proceeds: Float
    description: String
  }

  " input variables for updateDepreciationDisposal "
  input UpdateDepreciationDisposalInput {
    id: UUID!
    " pass null to unlink the charge "
    chargeId: UUID
    type: DepreciationDisposalType
    " COST_REFUND only; when left out, a cost refund keeps its mode (FROM_ACTIVATION when it becomes one) "
    refundMode: DepreciationRefundMode
    disposalDate: TimelessDate
    " the local cost; not for a COST_REFUND of an asset recorded in a foreign currency "
    disposedCost: Float
    " the refunded amount in the asset's currency, for a COST_REFUND of an asset recorded in a foreign currency; when left out, it is kept "
    originalAmount: Float
    " SALE only; when left out, a sale keeps its proceeds "
    proceeds: Float
    " pass null to clear it "
    description: String
  }

  " result type for insertDepreciationDisposal "
  union InsertDepreciationDisposalResult = DepreciationDisposal | CommonError

  " result type for updateDepreciationDisposal "
  union UpdateDepreciationDisposalResult = DepreciationDisposal | CommonError

  " result type for previewDepreciationDisposal "
  union PreviewDepreciationDisposalResult = DepreciationDisposalComputation | CommonError
`;
