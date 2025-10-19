import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  InsertClientDocument,
  type InsertClientMutation,
  type InsertClientMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

  const [{ fetching }, mutate] = useMutation(InsertClientDocument);
  const insertClient = useCallback(
    async (variables: InsertClientMutationVariables) => {
      const errorMessage = `Error creating client [${variables.fields.businessId}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.fields.businessId}`;
      toast.loading('Creating Client...', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, errorMessage, notificationId, 'insertClient');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: `Client [${variables.fields.businessId}] was created`,
          });
          return data.insertClient;
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
    insertClient,
  };
};
