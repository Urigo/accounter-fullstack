import {
  InsertDocumentDocument,
  type InsertDocumentMutation,
  type InsertDocumentMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: InsertDocumentDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Adding document',
    errorMessage: variables =>
      `Error inserting document to charge ID [${variables.record.chargeId}]`,
    commonErrorPath: 'insertDocument',
    select: data => data.insertDocument,
    successToast: { description: 'Document added' },
  });

  return {
    fetching,
    insertDocument: execute,
  };
};
