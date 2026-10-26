// The charge fields a charge mutation hands back, so the client learns the charge's new state from
// the mutation result instead of refetching it by id (#4481, a prerequisite for the normalized cache
// in #4480).
//
// It mirrors the eagerly-loaded part of `ChargeForChargesTableFields` (charges-table.tsx): the fields
// a mutation writes directly (description, tags, tax category, business trip, approval, type) and
// the ones derived from them (missing info, counts). The `@defer`red parts of that fragment are left
// out on purpose — urql resolves a mutation only once every deferred patch has arrived, so including
// them would hold every save's toast until the suggestions and ledger validation finish computing.
//
// `charge-mutation-result.test.ts` keeps the two fragments in step.

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargeMutationResultFields on Charge {
    id
    __typename
    minEventDate
    minDebitDate
    minDocumentsDate
    maxDebitDate
    maxEventDate
    maxDocumentsDate
    totalAmount {
      raw
      currency
    }
    vat {
      raw
    }
    counterparty {
      name
      id
    }
    userDescription
    tags {
      id
      name
      namePath
    }
    taxCategory {
      id
      name
    }
    ... on BusinessTripCharge {
      businessTrip {
        id
        name
      }
    }
    ... on ForeignSecuritiesCharge {
      counterparties {
        id
        name
      }
    }
    metadata {
      transactionsCount
      documentsCount
      ledgerCount
      miscExpensesCount
      depreciationRecordsCount
    }
    accountantApproval
    ... on CreditcardBankCharge {
      validCreditCardAmount
    }
    ... on Charge {
      validationData {
        missingInfo
      }
    }
  }
`;
