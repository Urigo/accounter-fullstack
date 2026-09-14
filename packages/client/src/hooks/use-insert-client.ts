import {
  InsertClientDocument,
  type InsertClientMutation,
  type InsertClientMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation InsertClient($fields: ClientInsertInput!) {
    insertClient(fields: $fields) {
      __typename
      ... on Client {
        id
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type InsertClientSuccessfulResult = Extract<
  InsertClientMutation['insertClient'],
  { __typename: 'Client' }
>;

type UseInsertClient = {
  fetching: boolean;
  insertClient: (
    variables: InsertClientMutationVariables,
  ) => Promise<InsertClientSuccessfulResult | void>;
};

const NOTIFICATION_ID = 'insertClient';

export const useInsertClient = (): UseInsertClient => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const { fetching, execute } = useApiMutation({
    document: InsertClientDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.fields.businessId}`,
    loadingMessage: 'Creating Client...',
    errorMessage: variables => `Error creating client [${variables.fields.businessId}]`,
    commonErrorPath: 'insertClient',
    select: data => data.insertClient,
    successToast: (_result, variables) => ({
      description: `Client [${variables.fields.businessId}] was created`,
    }),
  });

  return {
    fetching,
    insertClient: execute,
  };
};
