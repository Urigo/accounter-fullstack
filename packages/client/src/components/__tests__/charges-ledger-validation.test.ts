import { describe, expect, it } from 'vitest';
import type { ChargesLedgerValidationQuery } from '../../gql/graphql.js';
import { getFlaggedCharges } from '../charges-ledger-validation.js';

type Results = ChargesLedgerValidationQuery['chargesWithLedgerChanges'];

// Stand-ins for streamed payload items; the masked fragment refs don't matter to the helper.
const results = (items: unknown[]): Results => items as Results;

describe('getFlaggedCharges', () => {
  it('returns an empty list before any result arrives', () => {
    expect(getFlaggedCharges(undefined)).toEqual([]);
  });

  it('keeps streamed charges', () => {
    const charge = { id: 'charge-1', __typename: 'CommonCharge' };
    expect(getFlaggedCharges(results([{ progress: 50, charge }]))).toEqual([charge]);
  });

  it('drops progress-only items and charges that failed on the server', () => {
    expect(
      getFlaggedCharges(results([{ progress: 20 }, { progress: 40, charge: null }])),
    ).toEqual([]);
  });

  it('drops the partial charge urql builds from a deferred patch landing on a null charge', () => {
    // A deferred `metadata` patch that outlived its (nulled) charge: urql's incremental merge
    // turns `charge: null` into an object holding only the patched `metadata`.
    const partial = { metadata: { invalidLedger: 'DIFF', __typename: 'ChargeMetadata' } };
    const charge = { id: 'charge-2', __typename: 'CommonCharge' };
    expect(
      getFlaggedCharges(
        results([
          { progress: 60, charge: partial },
          { progress: 80, charge },
        ]),
      ),
    ).toEqual([charge]);
  });
});
