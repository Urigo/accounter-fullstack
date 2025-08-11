import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  InsertBusinessDocument,
  type InsertBusinessMutation,
  type InsertBusinessMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

  const [{ fetching }, mutate] = useMutation(InsertBusinessDocument);
  const insertBusiness = useCallback(
    async (variables: InsertBusinessMutationVariables) => {
      const errorMessage = `Error creating business [${variables.fields.name}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.fields.name}`;
      toast.loading('Creating Business...', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, errorMessage, notificationId, 'insertNewBusiness');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: `Business [${variables.fields.name}] was created`,
          });
          return data.insertNewBusiness;
        }
      } catch (e) {
        console.error(`${errorMessage}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: errorMessage,
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
    insertBusiness,
  };
};
