import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  IssueGreenInvoiceDocumentDocument,
  IssueGreenInvoiceDocumentMutation,
  IssueGreenInvoiceDocumentMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation IssueGreenInvoiceDocument(
    $input: NewDocumentInput!
    $emailContent: String
    $attachment: Boolean
  ) {
    issueGreenInvoiceDocument(input: $input, emailContent: $emailContent, attachment: $attachment) {
      id
    }
  }
`;

type IssueGreenInvoiceDocument = IssueGreenInvoiceDocumentMutation['issueGreenInvoiceDocument'];

type UseIssueDocument = {
  fetching: boolean;
  issueDocument: (
    variables: IssueGreenInvoiceDocumentMutationVariables,
  ) => Promise<IssueGreenInvoiceDocument | void>;
};

const NOTIFICATION_ID = 'issueDocument';

export const useIssueDocument = (): UseIssueDocument => {
  // TODO: add authentication
  // TODO: add local caching/optimization if needed

  const [{ fetching }, mutate] = useMutation(IssueGreenInvoiceDocumentDocument);

  const issueDocument = useCallback(
    async (variables: IssueGreenInvoiceDocumentMutationVariables) => {
      const message = 'Error generating document issue';
      const notificationId = NOTIFICATION_ID;

      toast.loading('Generating document issue...', {
        id: notificationId,
      });

      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'issueGreenInvoiceDocument');

        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Document issue generated',
            duration: 3000,
          });
          return data.issueGreenInvoiceDocument;
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
    issueDocument,
  };
};
