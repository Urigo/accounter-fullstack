import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { RegenerateLedgerDocument, type RegenerateLedgerMutation } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

export const useRegenerateLedgerRecords = (): UseRegenerateLedgerRecords => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(RegenerateLedgerDocument);
  const regenerateLedgerRecords = useCallback(
    async (chargeIds: string[]) => {
      const message = 'Error regenerating ledger';
      const isBatch = chargeIds.length > 1;
      // Keep the toast id short and stable: per-charge for a single regenerate (so it dedupes with
      // that charge's own toast), a fixed id for a batch (joining every UUID could grow unbounded).
      const notificationId = isBatch
        ? `${NOTIFICATION_ID}-batch`
        : `${NOTIFICATION_ID}-${chargeIds[0]}`;
      toast.loading(
        isBatch ? `Regenerating Ledger for ${chargeIds.length} charges` : 'Regenerating Ledger',
        {
          id: notificationId,
        },
      );
      try {
        const res = await mutate({ chargeIds });
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          const results = data.regenerateLedgerRecords;
          const failures = results.filter(result => result.__typename === 'CommonError');

          // Every charge failed — surface the combined message via the error branch below.
          if (failures.length > 0 && failures.length === results.length) {
            throw new Error(failures.map(failure => failure.message).join('\n'));
          }

          if (failures.length > 0) {
            toast.warning('Partial success', {
              id: notificationId,
              description: `${results.length - failures.length}/${results.length} charges regenerated. ${failures.length} failed.`,
              duration: 100_000,
              closeButton: true,
            });
          } else {
            toast.success('Success', {
              id: notificationId,
              description: isBatch
                ? `Ledger records were regenerated for ${results.length} charges`
                : 'Ledger records were regenerated',
            });
          }
          return results;
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: e instanceof Error ? e.message : message,
          duration: 100_000,
          closeButton: true,
        });
      }
      return void 0;
    },
    [mutate],
  );

  return {
    fetching,
    regenerateLedgerRecords,
  };
};
