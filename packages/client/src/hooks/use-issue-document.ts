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
    $chargeId: UUID
  ) {
    issueGreenInvoiceDocument(
      input: $input
      emailContent: $emailContent
      attachment: $attachment
      chargeId: $chargeId
    ) {
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
      const message = 'Error issuing document';
      const notificationId = NOTIFICATION_ID;

      toast.loading('Issuing document...', {
        id: notificationId,
      });

      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'issueGreenInvoiceDocument');

        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Document issued successfully',
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
