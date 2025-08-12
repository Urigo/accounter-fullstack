import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  InsertDocumentDocument,
  type InsertDocumentMutation,
  type InsertDocumentMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation InsertDocument($record: InsertDocumentInput!) {
    insertDocument(record: $record) {
      __typename
      ... on InsertDocumentSuccessfulResult {
        document {
          id
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type InsertDocumentSuccessfulResult = Extract<
  InsertDocumentMutation['insertDocument'],
  { __typename: 'InsertDocumentSuccessfulResult' }
>;

type UseInsertDocument = {
  fetching: boolean;
  insertDocument: (
    variables: InsertDocumentMutationVariables,
  ) => Promise<InsertDocumentSuccessfulResult | void>;
};

const NOTIFICATION_ID = 'insertDocument';

export const useInsertDocument = (): UseInsertDocument => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const [{ fetching }, mutate] = useMutation(InsertDocumentDocument);
  const insertDocument = useCallback(
    async (variables: InsertDocumentMutationVariables) => {
      const message = `Error inserting document to charge ID [${variables.record.chargeId}]`;
      const notificationId = NOTIFICATION_ID;
      toast.loading('Adding document', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'insertDocument');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Document added',
          });
          return data.insertDocument;
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
    insertDocument,
  };
};
