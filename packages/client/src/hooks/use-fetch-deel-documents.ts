import { createElement, useCallback } from 'react';
import { FetchDeelDocumentsDocument, type FetchDeelDocumentsMutation } from '../gql/graphql.js';
import { useApiMutation, type SuccessToast } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation FetchDeelDocuments {
    fetchDeelDocuments {
      __typename
      ... on CommonError {
        message
      }
      ... on DeelSyncResult {
        charges {
          id
        }
        issues {
          code
          message
          invoiceIds
          receiptId
          contractId
        }
      }
    }
  }
`;

type FetchDeelDocumentsResult = Extract<
  FetchDeelDocumentsMutation['fetchDeelDocuments'],
  { __typename: 'DeelSyncResult' }
>;

type UseFetchDeelDocuments = {
  fetching: boolean;
  fetchDocuments: () => Promise<FetchDeelDocumentsResult | void>;
};

const NOTIFICATION_ID = 'fetch-deel-documents';
const MAX_LISTED_ISSUES = 5;

function syncToast({ charges, issues }: FetchDeelDocumentsResult): SuccessToast {
  const summary = `Synced ${charges.length} Deel charge(s)`;
  if (issues.length === 0) {
    return { description: summary };
  }

  const listed = issues.slice(0, MAX_LISTED_ISSUES);
  const remaining = issues.length - listed.length;
  return {
    title: 'Deel sync finished with issues',
    variant: 'warning',
    duration: 100_000,
    closeButton: true,
    // a hook module holds no JSX (codegen scans hooks as `.ts`), hence createElement
    description: createElement(
      'div',
      { className: 'flex flex-col gap-1' },
      createElement('span', null, `${summary}; ${issues.length} issue(s):`),
      createElement(
        'ul',
        { className: 'list-disc pl-4' },
        listed.map((issue, index) =>
          createElement('li', { key: `${issue.code}-${index}` }, issue.message),
        ),
      ),
      remaining > 0
        ? createElement('span', null, `…and ${remaining} more (see the browser console)`)
        : null,
    ),
  };
}

export const useFetchDeelDocuments = (): UseFetchDeelDocuments => {
  const { fetching, execute } = useApiMutation({
    document: FetchDeelDocumentsDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Fetching Deel documents',
    errorMessage: 'Failed to fetch Deel documents',
    commonErrorPath: 'fetchDeelDocuments',
    select: data => data.fetchDeelDocuments,
    successToast: syncToast,
    onSuccess: result => {
      if (result.issues.length) {
        console.warn('Deel sync issues:', result.issues);
      }
    },
  });

  const fetchDocuments = useCallback(() => execute({}), [execute]);

  return { fetching, fetchDocuments };
};
