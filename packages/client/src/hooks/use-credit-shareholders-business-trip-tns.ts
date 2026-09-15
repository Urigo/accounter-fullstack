import {
  CreditShareholdersBusinessTripTravelAndSubsistenceDocument,
  type CreditShareholdersBusinessTripTravelAndSubsistenceMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CreditShareholdersBusinessTripTravelAndSubsistence($businessTripId: UUID!) {
    creditShareholdersBusinessTripTravelAndSubsistence(businessTripId: $businessTripId)
  }
`;

type UseCreditShareholdersBusinessTripTravelAndSubsistence = {
  fetching: boolean;
  /** Resolves to the number of charges generated, or to nothing on failure. */
  creditShareholders: (
    variables: CreditShareholdersBusinessTripTravelAndSubsistenceMutationVariables,
  ) => Promise<number | void>;
};

const NOTIFICATION_ID = 'creditShareholdersBusinessTripTravelAndSubsistence';

export const useCreditShareholdersBusinessTripTnS =
  (): UseCreditShareholdersBusinessTripTravelAndSubsistence => {
    // TODO: add authentication
    // TODO: add local data update method after change

    const { fetching, execute } = useApiMutation({
      document: CreditShareholdersBusinessTripTravelAndSubsistenceDocument,
      notificationId: variables => `${NOTIFICATION_ID}-${variables.businessTripId}`,
      loadingMessage: 'Crediting Shareholders',
      errorMessage: variables =>
        `Error crediting shareholders for trip ID ${variables.businessTripId}`,
      select: data => data.creditShareholdersBusinessTripTravelAndSubsistence.length,
      successToast: chargesCount => ({
        title: 'Shareholders Credited',
        description: `${chargesCount} Corresponding charges were successfully generated`,
      }),
    });

    return {
      fetching,
      creditShareholders: execute,
    };
  };
