import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  CreditShareholdersBusinessTripTravelAndSubsistenceDocument,
  type CreditShareholdersBusinessTripTravelAndSubsistenceMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CreditShareholdersBusinessTripTravelAndSubsistence($businessTripId: UUID!) {
    creditShareholdersBusinessTripTravelAndSubsistence(businessTripId: $businessTripId)
  }
`;

type UseCreditShareholdersBusinessTripTravelAndSubsistence = {
  fetching: boolean;
  creditShareholders: (
    variables: CreditShareholdersBusinessTripTravelAndSubsistenceMutationVariables,
  ) => Promise<void>;
};

const NOTIFICATION_ID = 'creditShareholdersBusinessTripTravelAndSubsistence';

export const useCreditShareholdersBusinessTripTnS =
  (): UseCreditShareholdersBusinessTripTravelAndSubsistence => {
    // TODO: add authentication
    // TODO: add local data update method after change

    const [{ fetching }, mutate] = useMutation(
      CreditShareholdersBusinessTripTravelAndSubsistenceDocument,
    );
    const creditShareholders = useCallback(
      async (variables: CreditShareholdersBusinessTripTravelAndSubsistenceMutationVariables) => {
        const message = `Error crediting shareholders for trip ID ${variables.businessTripId}`;
        const notificationId = `${NOTIFICATION_ID}-${variables.businessTripId}`;
        toast.loading('Crediting Shareholders', {
          id: notificationId,
        });
        try {
          const res = await mutate(variables);
          const data = handleCommonErrors(res, message, notificationId);
          if (data) {
            toast.success('Shareholders Credited', {
              id: notificationId,
              description: `${data.creditShareholdersBusinessTripTravelAndSubsistence.length} Corresponding charges were successfully generated`,
            });
          }
        } catch (e) {
          console.error(`${message}: ${e}`);
          toast.error('Error', {
            id: notificationId,
            description: message,
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
      creditShareholders,
    };
  };
