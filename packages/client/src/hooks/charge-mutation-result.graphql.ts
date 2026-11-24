// The charge fields a charge mutation hands back, so the client learns the charge's new state from
// the mutation result instead of refetching it by id (#4481). The client cache
// (providers/urql-cache.ts) writes them onto the charge, and every table showing it updates.
//
// They are the fields a charges-table row shows as soon as it loads, `ChargesTableRowFields`
// (components/charges/charges-table.tsx): one fragment per cell. The row's `@defer`red parts, the
// suggestions and the ledger validation, are left out on purpose — urql resolves a mutation only
// once every deferred patch has arrived, so including them would hold every save's toast until
// they finish computing.
//
// `charge-mutation-result.test.ts` keeps the row and this payload in step.

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargeMutationResultFields on Charge {
    id
    ...ChargesTableRowFields
  }
`;
