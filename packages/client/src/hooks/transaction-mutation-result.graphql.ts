// The transaction fields a transaction mutation hands back, so the client learns the transaction's new
// state - and its charge's - from the mutation result instead of refetching them (#4481, a
// prerequisite for the normalized cache in #4480).
//
// The row is the transactions table's own fragment, spread rather than copied: it has no `@defer`red
// parts to leave out, so the two can't drift. A transaction change also moves its charge's amounts,
// dates, counterparty and approval, so the charge comes back too, with the ids of its transactions
// for when a transaction moved into it.

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TransactionMutationResultFields on Transaction {
    id
    __typename
    ...TransactionForTransactionsTableFields
    charge {
      id
      ...ChargeMutationResultFields
      transactions {
        id
      }
    }
  }
`;
