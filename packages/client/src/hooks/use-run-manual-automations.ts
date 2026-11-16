import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation, type CombinedError } from 'urql';
import {
  summarizeAutomationEvents,
  type ManualAutomationsRunEvent,
} from '../components/manual-automations/manual-automations-events.js';
import { RunCronJobsDocument } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation RunCronJobs {
    runCronJobs {
      events @stream {
        __typename
        ... on CronJobStepStatus {
          step
          state
          affectedCount
          errors
        }
        ... on ForeignFeeTransactionFlagged {
          transaction {
            id
            chargeId
            eventDate
            sourceDescription
            amount {
              formatted
            }
            account {
              id
              name
            }
          }
        }
        ... on ChargesMergedByReference {
          reference
          baseCharge {
            id
            userDescription
            minEventDate
            totalAmount {
              formatted
            }
            counterparty {
              id
              name
            }
          }
          mergedCharges {
            id
            description
            date
            amount {
              formatted
            }
          }
        }
        ... on CreditcardDebitDateFilled {
          debitDate
          transaction {
            id
            chargeId
            eventDate
            sourceDescription
            amount {
              formatted
            }
            account {
              id
              name
            }
          }
        }
      }
    }
  }
`;

const NOTIFICATION_ID = 'run-manual-automations';
const ERROR_MESSAGE = 'Error running automations';

type UseRunManualAutomations = {
  /** True from the moment the run starts until its last streamed event arrives. */
  running: boolean;
  /** Events received so far, in the order they happened. */
  events: readonly ManualAutomationsRunEvent[];
  error: CombinedError | undefined;
  runJobs: () => Promise<void>;
};

export const useRunManualAutomations = (): UseRunManualAutomations => {
  // `useMutation` updates its state on every streamed part, but clears `fetching` on the first
  // one — `hasNext` is what tells a run in progress from a finished one.
  const [{ fetching, hasNext, data, error }, mutate] = useMutation(RunCronJobsDocument);

  const runJobs = useCallback(async () => {
    toast.loading('Running automations', { id: NOTIFICATION_ID });
    try {
      const res = await mutate({});
      const resData = handleCommonErrors(res, ERROR_MESSAGE, NOTIFICATION_ID);
      if (!resData) {
        return;
      }
      const { failed, withErrors, description } = summarizeAutomationEvents(
        resData.runCronJobs.events,
      );
      if (failed) {
        toast.error('Error', { id: NOTIFICATION_ID, description, closeButton: true });
      } else if (withErrors) {
        toast.warning('Done, with errors', { id: NOTIFICATION_ID, description });
      } else {
        toast.success('Success', { id: NOTIFICATION_ID, description });
      }
    } catch (e) {
      console.error(`${ERROR_MESSAGE}:`, e);
      toast.error('Error', {
        id: NOTIFICATION_ID,
        description: ERROR_MESSAGE,
        duration: 100_000,
        closeButton: true,
      });
    }
  }, [mutate]);

  return {
    running: fetching || !!hasNext,
    events: data?.runCronJobs.events ?? [],
    error,
    runJobs,
  };
};
