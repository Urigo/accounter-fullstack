import { useMutation } from 'urql';
import { notifications, showNotification } from '@mantine/notifications';
import {
  UpdateDocumentDocument,
  UpdateDocumentMutation,
  UpdateDocumentMutationVariables,
} from '../gql/graphql.js';
import { useHandleKnownErrors } from './use-handle-known-errors.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateDocument($documentId: UUID!, $fields: UpdateDocumentFieldsInput!) {
    updateDocument(documentId: $documentId, fields: $fields) {
      __typename
      ... on CommonError {
        message
      }
      ... on UpdateDocumentSuccessfulResult {
        document {
          id
        }
      }
    }
  }
`;

type UpdateDocumentSuccessfulResult = Extract<
  UpdateDocumentMutation['updateDocument'],
  { __typename: 'UpdateDocumentSuccessfulResult' }
>;

type UseUpdateDocument = {
  fetching: boolean;
  updateDocument: (
    variables: UpdateDocumentMutationVariables,
  ) => Promise<UpdateDocumentSuccessfulResult>;
};

const NOTIFICATION_ID = 'updateDocument';

export const useUpdateDocument = (): UseUpdateDocument => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateDocumentDocument);
  const { handleKnownErrors } = useHandleKnownErrors();

  return {
    fetching,
    updateDocument: (
      variables: UpdateDocumentMutationVariables,
    ): Promise<UpdateDocumentSuccessfulResult> =>
      new Promise<UpdateDocumentSuccessfulResult>((resolve, reject) => {
        const notificationId = `${NOTIFICATION_ID}-${variables.documentId}`;
        const message = `Error updating document ID [${variables.documentId}]`;

        return mutate(variables).then(res => {
          notifications.show({
            id: notificationId,
            loading: true,
            title: 'Updating document',
            message: 'Please wait...',
            autoClose: false,
            withCloseButton: true,
          });

          const data = handleKnownErrors(res, reject, message, notificationId);
          if (data) {
            if (data.updateDocument.__typename === 'CommonError') {
              console.error(`${message}: ${data.updateDocument.message}`);
              showNotification({
                title: 'Error!',
                message: 'Oh no!, we have an error! 🤥',
              });
              return reject(data.updateDocument.message);
            }
            showNotification({
              title: 'Update Success!',
              message: 'Hey there, your update is awesome!',
            });
            return resolve(data.updateDocument);
          }
        });
      }),
  };
};
