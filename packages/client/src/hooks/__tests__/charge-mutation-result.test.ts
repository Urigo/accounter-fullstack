import { describe, expect, it } from 'vitest';
import {
  ChargeForChargesTableFieldsFragmentDoc,
  ChargeMutationResultFieldsFragmentDoc,
} from '../../gql/graphql.js';
import { selectionsOf } from './fragment-selections.js';

describe('ChargeMutationResultFields', () => {
  // A charge mutation's payload is what tells the client the charge's new state. If the charges
  // table starts reading a field the payload doesn't carry, the row shows the pre-mutation value
  // for it — so the payload must track the table's eager fields exactly.
  it("selects exactly the charges table row's eagerly-loaded fields", () => {
    expect(selectionsOf(ChargeMutationResultFieldsFragmentDoc, 'ChargeMutationResultFields')).toBe(
      selectionsOf(ChargeForChargesTableFieldsFragmentDoc, 'ChargeForChargesTableFields'),
    );
  });
});
