import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UploadDocumentDocument,
  UploadDocumentMutation,
  UploadDocumentMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UploadDocument($file: FileScalar!, $chargeId: UUID) {
    uploadDocument(file: $file, chargeId: $chargeId) {
      __typename
      ... on UploadDocumentSuccessfulResult {
        document {
          id
          charge {
            id
          }
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type UploadDocumentSuccessfulResult = Extract<
  UploadDocumentMutation['uploadDocument'],
  { __typename: 'UploadDocumentSuccessfulResult' }
>;

type UseUploadDocument = {
  fetching: boolean;
  uploadDocument: (
    variables: UploadDocumentMutationVariables,
  ) => Promise<UploadDocumentSuccessfulResult | void>;
};

const NOTIFICATION_ID = 'uploadDocument';

export const useUploadDocument = (): UseUploadDocument => {
  // TODO: add authentication
  // TODO: add local data update method after upload

  const [{ fetching }, mutate] = useMutation(UploadDocumentDocument);
  const uploadDocument = useCallback(
    async (variables: UploadDocumentMutationVariables) => {
      const message =
        'Error uploading document' + variables.chargeId
          ? ` to charge ID [${variables.chargeId}]`
          : '';
      const notificationId = `${NOTIFICATION_ID}-${variables.chargeId}`;
      toast.loading('Uploading Document', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'uploadDocument');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Document was added',
          });
          return data.uploadDocument;
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
    uploadDocument,
  };
};
