import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  IssueMonthlyDocumentsDocument,
  type IssueMonthlyDocumentsMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation IssueMonthlyDocuments($generateDocumentsInfo: [DocumentIssueInput!]!) {
    issueGreenInvoiceDocuments(generateDocumentsInfo: $generateDocumentsInfo) {
      success
      errors
    }
  }
`;

type UseIssueMonthlyDocuments = {
  fetching: boolean;
  issueDocuments: (variables: IssueMonthlyDocumentsMutationVariables) => Promise<void>;
};

const NOTIFICATION_ID = 'issue-monthly-documents';

export const useIssueMonthlyDocuments = (): UseIssueMonthlyDocuments => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(IssueMonthlyDocumentsDocument);
  const issueDocuments = useCallback(
    async (variables: IssueMonthlyDocumentsMutationVariables) => {
      const message = 'Error issuing monthly documents';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Issuing documents', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data?.issueGreenInvoiceDocuments?.success) {
          toast.success('Success', {
            id: notificationId,
            description: 'Documents issued successfully',
          });
          return;
        }

        if (data?.issueGreenInvoiceDocuments?.errors) {
          console.error(data.issueGreenInvoiceDocuments.errors);
        }
        toast.error('Error', {
          id: notificationId,
          description: message,
          duration: 100_000,
          closeButton: true,
        });
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
    issueDocuments,
  };
};
