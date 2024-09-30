import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  CreditShareholdersBusinessTripTravelAndSubsistenceDocument,
  CreditShareholdersBusinessTripTravelAndSubsistenceMutationVariables,
} from '../gql/graphql.js';

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

export const useCreditShareholdersBusinessTripTnS =
  (): UseCreditShareholdersBusinessTripTravelAndSubsistence => {
    // TODO: add authentication
    // TODO: add local data update method after change

    const [{ fetching }, mutate] = useMutation(
      CreditShareholdersBusinessTripTravelAndSubsistenceDocument,
    );

    return {
      fetching,
      creditShareholders: (
        variables: CreditShareholdersBusinessTripTravelAndSubsistenceMutationVariables,
      ): Promise<void> =>
        new Promise<void>((resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(
                `Error crediting shareholders for trip ID ${variables.businessTripId}: ${res.error}`,
              );
              showNotification({
                title: 'Error!',
                message: 'Oh no!, we have an error! 🤥',
              });
              return reject(res.error.message);
            }
            if (!res.data?.creditShareholdersBusinessTripTravelAndSubsistence) {
              console.error(`Error crediting shareholders for trip ID ${variables.businessTripId}`);
              showNotification({
                title: 'Error!',
                message: 'Oh no!, we have an error! 🤥',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Shareholders Credited!',
              message: `${res.data.creditShareholdersBusinessTripTravelAndSubsistence.length} Corresponding charges were successfully generated`,
            });
            return resolve();
          }),
        ),
    };
  };
