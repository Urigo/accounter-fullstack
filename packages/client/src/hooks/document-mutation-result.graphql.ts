// The document fields a document mutation hands back, so the client learns the document's new state -
// and its charge's - from the mutation result instead of refetching them (#4481, a prerequisite for
// the normalized cache in #4480).
//
// The row is the documents table's own fragment, spread rather than copied: it has no `@defer`red
// parts to leave out, so the two can't drift. A document change also moves its charge's amounts,
// VAT, dates, missing info and approval, so the charge comes back too, with the ids of its documents
// for when a document was added to it or moved into it.

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DocumentMutationResultFields on Document {
    id
    __typename
    ...TableDocumentsRowFields
    charge {
      id
      ...ChargeMutationResultFields
      additionalDocuments {
        id
      }
    }
  }
`;
