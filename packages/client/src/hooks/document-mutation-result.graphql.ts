// The document fields a document mutation hands back, so the client learns the document's new state -
// and its charge's - from the mutation result instead of refetching them (#4481, a prerequisite for
// the normalized cache in #4480).
//
// `DocumentMutationRowFields` mirrors the documents table's row (`TableDocumentsRowFields`,
// documents-table/columns.tsx) except for `issuedDocumentInfo.originalDocument`. That field calls the
// Green Invoice API, and it throws when the call fails - in a payload, that would report a write that
// already committed (an issued tax document, an upload) as failed, and add a round trip to every
// save. `issuedDocumentInfo { id status }` stays: it is read from the DB.
//
// A document change also moves its charge's amounts, VAT, dates, missing info and approval, so the
// charge comes back too, with the ids of its documents for when a document was added to it or moved
// into it.
//
// `document-mutation-result.test.ts` keeps the row in step with the table's.

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DocumentMutationRowFields on Document {
    id
    documentType
    image
    file
    description
    remarks
    charge {
      id
    }
    ... on FinancialDocument {
      amount {
        raw
        formatted
        currency
      }
      missingInfoSuggestions {
        amount {
          raw
          formatted
          currency
        }
        isIncome
        counterparty {
          id
          name
        }
        owner {
          id
          name
        }
      }
      date
      vat {
        raw
        formatted
        currency
      }
      serialNumber
      allocationNumber
      creditor {
        id
        name
      }
      debtor {
        id
        name
      }
      issuedDocumentInfo {
        id
        status
      }
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DocumentMutationResultFields on Document {
    id
    __typename
    ...DocumentMutationRowFields
    charge {
      id
      ...ChargeMutationResultFields
      additionalDocuments {
        id
      }
    }
  }
`;
