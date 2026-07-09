// GraphQL operations for the charge matching review screen.
// The MergeCharges mutation is NOT defined here on purpose — it already exists
// in `src/hooks/use-merge-charges.ts` and is reused via the useMergeCharges hook.

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargeMatchCardFields on Charge {
    __typename
    id
    minEventDate
    minDebitDate
    minDocumentsDate
    totalAmount {
      raw
      formatted
      currency
    }
    counterparty {
      id
      name
    }
    userDescription
    additionalDocuments {
      id
      documentType
      image
      file
    }
    transactions {
      id
      eventDate
      sourceDescription
      amount {
        raw
        formatted
      }
    }
    miscExpenses {
      id
      description
      amount {
        formatted
      }
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargesAwaitingMatchQueue(
    $limit: Int
    $offset: Int
    $businessId: UUID
    $fromDate: TimelessDate
    $toDate: TimelessDate
    $mode: ChargeMatchQueueMode
    $sortBy: ChargeMatchQueueSortBy
  ) {
    chargesAwaitingMatchQueue(
      limit: $limit
      offset: $offset
      businessId: $businessId
      fromDate: $fromDate
      toDate: $toDate
      mode: $mode
      sortBy: $sortBy
    ) {
      totalCount
      baseCharges {
        baseCharge {
          ...ChargeMatchCardFields
        }
        suggestions {
          chargeId
          confidenceScore
          charge {
            ...ChargeMatchCardFields
          }
        }
      }
    }
  }
`;
