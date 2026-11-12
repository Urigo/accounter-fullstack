// The misc expense fields a misc-expense mutation hands back, so the client learns the expense's new
// state - and its charge's - from the mutation result instead of refetching them (#4481, a
// prerequisite for the normalized cache in #4480).
//
// The row is the misc-expenses table's own fragment, spread rather than copied so the two can't
// drift. An expense change also moves its charge's counterparty, counts and approval, so the charge
// comes back too, with the ids of its expenses for when one was added to it or moved into it.

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment MiscExpenseMutationResultFields on MiscExpense {
    id
    __typename
    ...TableMiscExpenseRowFields
    charge {
      id
      ...ChargeMutationResultFields
      miscExpenses {
        id
      }
    }
  }
`;
