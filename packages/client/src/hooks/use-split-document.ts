import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  SplitDocumentDocument,
  SplitDocumentMutation,
  SplitDocumentMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation SplitDocument($documentId: UUID!,
      $splitAmount: Float!,
      $underSameCharge: Boolean) {
    splitDocument(documentId: $documentId,
      splitAmount: $splitAmount,
      underSameCharge: $underSameCharge) {
      __typename
      ... on SplitDocumentSuccessfulResult {
        documents {
          id
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type SplitDocumentSuccessfulResult = Extract<
  SplitDocumentMutation['splitDocument'],
  { __typename: 'SplitDocumentSuccessfulResult' }
>;

type UseSplitDocument = {
  fetching: boolean;
  splitDocument: (
    variables: SplitDocumentMutationVariables,
  ) => Promise<SplitDocumentSuccessfulResult>;
};

export const useSplitDocument = (): UseSplitDocument => {
  // TODO: add authentication
  // TODO: add local data update method after split

  const [{ fetching }, mutate] = useMutation(SplitDocumentDocument);

  return {
    fetching,
    splitDocument: (
      variables: SplitDocumentMutationVariables,
    ): Promise<SplitDocumentSuccessfulResult> =>
      new Promise<SplitDocumentSuccessfulResult>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(`Error splitting document ID [${variables.documentId}]: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(
              `Error splitting document ID [${variables.documentId}]: No data returned`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (res.data.splitDocument.__typename === 'CommonError') {
            console.error(
              `Error splitting document ID [${variables.documentId}]: ${res.data.splitDocument.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.data.splitDocument.message);
          }
          showNotification({
            title: 'Split Success!',
            message: 'Your document was splitted! 🎉',
          });
          return resolve(res.data.splitDocument);
        }),
      ),
  };
};
