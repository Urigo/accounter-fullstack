import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  IssueMonthlyDocumentsDocument,
  IssueMonthlyDocumentsMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation IssueMonthlyDocuments(
    $generateDocumentsInfo: [GenerateDocumentInfo!]!
    $issueMonth: TimelessDate
  ) {
    generateMonthlyClientDocuments(
      generateDocumentsInfo: $generateDocumentsInfo
      issueMonth: $issueMonth
    ) {
      success
      errors
    }
  }
`;

type UseIssueMonthlyDocuments = {
  fetching: boolean;
  issueDocuments: (variables: IssueMonthlyDocumentsMutationVariables) => Promise<void>;
};

const NOTIFICATION_ID = 'IssueMonthlyDocuments';

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
        if (data?.generateMonthlyClientDocuments?.success) {
          toast.success('Success', {
            id: notificationId,
            description: 'Business updated',
          });
          return;
        }

        if (data?.generateMonthlyClientDocuments?.errors) {
          console.error(data.generateMonthlyClientDocuments.errors);
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
