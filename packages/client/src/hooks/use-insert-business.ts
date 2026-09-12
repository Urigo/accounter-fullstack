import {
  InsertBusinessDocument,
  type InsertBusinessMutation,
  type InsertBusinessMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation InsertBusiness($fields: InsertNewBusinessInput!) {
    insertNewBusiness(fields: $fields) {
      __typename
      ... on LtdFinancialEntity {
        id
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type InsertBusinessSuccessfulResult = Extract<
  InsertBusinessMutation['insertNewBusiness'],
  { __typename: 'LtdFinancialEntity' }
>;

type UseInsertBusiness = {
  fetching: boolean;
  insertBusiness: (
    variables: InsertBusinessMutationVariables,
  ) => Promise<InsertBusinessSuccessfulResult | void>;
};

const NOTIFICATION_ID = 'insertNewBusiness';

export const useInsertBusiness = (): UseInsertBusiness => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const { fetching, execute } = useApiMutation({
    document: InsertBusinessDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.fields.name}`,
    loadingMessage: 'Creating Business...',
    errorMessage: variables => `Error creating business [${variables.fields.name}]`,
    commonErrorPath: 'insertNewBusiness',
    select: data => data.insertNewBusiness,
    successToast: (_result, variables) => ({
      description: `Business [${variables.fields.name}] was created`,
    }),
  });

  return {
    fetching,
    insertBusiness: execute,
  };
};
