import { useCallback } from 'react';
import { RegenerateLedgerDocument, type RegenerateLedgerMutation } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation RegenerateLedger($chargeIds: [UUID!]!) {
    regenerateLedgerRecords(chargeIds: $chargeIds) {
      __typename
      ... on Ledger {
        records {
          id
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type RegenerateResult = RegenerateLedgerMutation['regenerateLedgerRecords'][number];

type UseRegenerateLedgerRecords = {
  fetching: boolean;
  /**
   * Regenerate ledger records for the given charges. The single regenerate button passes a
   * one-element array; the batch action passes every selected charge. Each charge is regenerated
   * independently server-side, so partial failures are reported without failing the rest.
   */
  regenerateLedgerRecords: (chargeIds: string[]) => Promise<RegenerateResult[] | void>;
};

const NOTIFICATION_ID = 'regenerateLedgerRecords';

/** The mutation's list variable also accepts a bare id, so normalise before counting. */
const toChargeIds = (chargeIds: string | string[]): string[] =>
  Array.isArray(chargeIds) ? chargeIds : [chargeIds];

export const useRegenerateLedgerRecords = (): UseRegenerateLedgerRecords => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: RegenerateLedgerDocument,
    // Keep the toast id short and stable: per-charge for a single regenerate (so it dedupes with
    // that charge's own toast), a fixed id for a batch (joining every UUID could grow unbounded).
    notificationId: variables => {
      const chargeIds = toChargeIds(variables.chargeIds);
      return chargeIds.length > 1
        ? `${NOTIFICATION_ID}-batch`
        : `${NOTIFICATION_ID}-${chargeIds[0]}`;
    },
    loadingMessage: variables => {
      const chargeIds = toChargeIds(variables.chargeIds);
      return chargeIds.length > 1
        ? `Regenerating Ledger for ${chargeIds.length} charges`
        : 'Regenerating Ledger';
    },
    errorMessage: 'Error regenerating ledger',
    select: data => {
      const results = data.regenerateLedgerRecords;
      const failures = results.filter(result => result.__typename === 'CommonError');

      // Every charge failed — surface the combined message via the error branch.
      if (failures.length > 0 && failures.length === results.length) {
        throw new Error(failures.map(failure => failure.message).join('\n'));
      }

      return results;
    },
    successToast: (results, variables) => {
      const failures = results.filter(result => result.__typename === 'CommonError');
      if (failures.length > 0) {
        return {
          variant: 'warning',
          title: 'Partial success',
          description: `${results.length - failures.length}/${results.length} charges regenerated. ${failures.length} failed.`,
          duration: 100_000,
          closeButton: true,
        };
      }
      return {
        description:
          toChargeIds(variables.chargeIds).length > 1
            ? `Ledger records were regenerated for ${results.length} charges`
            : 'Ledger records were regenerated',
      };
    },
    errorDescription: e => (e instanceof Error ? e.message : 'Error regenerating ledger'),
  });

  const regenerateLedgerRecords = useCallback(
    (chargeIds: string[]) => execute({ chargeIds }),
    [execute],
  );

  return {
    fetching,
    regenerateLedgerRecords,
  };
};
