import { describe, expect, it } from 'vitest';
import {
  DocumentMutationRowFieldsFragmentDoc,
  TableDocumentsRowFieldsFragmentDoc,
} from '../../gql/graphql.js';
import { selectionsOf } from './fragment-selections.js';

describe('DocumentMutationRowFields', () => {
  // A document mutation's payload is what tells the client the document's new state, so it must
  // carry every field the documents table reads - except `originalDocument`, a Green Invoice call
  // that must not be able to report a committed write (an issued document, an upload) as failed.
  it("selects the documents table row's fields, minus originalDocument", () => {
    expect(selectionsOf(DocumentMutationRowFieldsFragmentDoc, 'DocumentMutationRowFields')).toBe(
      selectionsOf(TableDocumentsRowFieldsFragmentDoc, 'TableDocumentsRowFields', {
        omitFields: ['originalDocument'],
      }),
    );
  });
});
