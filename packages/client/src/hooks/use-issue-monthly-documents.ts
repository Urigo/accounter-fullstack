import {
  IssueMonthlyDocumentsDocument,
  type IssueMonthlyDocumentsMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: IssueMonthlyDocumentsDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Issuing documents',
    errorMessage: 'Error issuing monthly documents',
    select: data => {
      const result = data.issueGreenInvoiceDocuments;
      if (!result?.success) {
        if (result?.errors) {
          console.error(result.errors);
        }
        throw new Error('Documents were not issued');
      }
      return void 0;
    },
    successToast: { description: 'Documents issued successfully' },
  });

  return {
    fetching,
    issueDocuments: execute,
  };
};
