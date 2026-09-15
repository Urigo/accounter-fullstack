import {
  IssueGreenInvoiceDocumentDocument,
  type IssueGreenInvoiceDocumentMutation,
  type IssueGreenInvoiceDocumentMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation IssueGreenInvoiceDocument(
    $input: DocumentIssueInput!
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

  const { fetching, execute } = useApiMutation({
    document: IssueGreenInvoiceDocumentDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Issuing document...',
    errorMessage: 'Error issuing document',
    commonErrorPath: 'issueGreenInvoiceDocument',
    select: data => data.issueGreenInvoiceDocument,
    successToast: { description: 'Document issued successfully', duration: 3000 },
  });

  return {
    fetching,
    issueDocument: execute,
  };
};
