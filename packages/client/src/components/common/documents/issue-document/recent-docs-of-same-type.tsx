'use client';

import { useQuery } from 'urql';
import { DocumentType, RecentIssuedDocumentsOfSameTypeDocument } from '../../../../gql/graphql.js';
import { useReconcileViewerRows } from '../../../documents-table/data-table.js';
import { DocumentsTable } from '../../../documents-table/index.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query RecentIssuedDocumentsOfSameType($documentType: DocumentType!) {
    recentIssuedDocumentsByType(documentType: $documentType) {
      id
      ...TableDocumentsRowFields
    }
  }
`;

interface RecentDocsOfSameTypeProps {
  documentType: DocumentType;
}

export function RecentDocsOfSameType({ documentType }: RecentDocsOfSameTypeProps) {
  const [{ data, fetching }] = useQuery({
    query: RecentIssuedDocumentsOfSameTypeDocument,
    variables: {
      documentType,
    },
  });

  const documents = data?.recentIssuedDocumentsByType ?? [];
  // The table unmounts while fetching, so the viewer's row reconcile runs here instead. Membership
  // is all it compares, so the query's order serves.
  useReconcileViewerRows(fetching ? null : documents.map(document => document.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Documents of the Same Type</CardTitle>
      </CardHeader>
      <CardContent>
        {fetching ? <div>Loading...</div> : <DocumentsTable documentsProps={documents} />}
      </CardContent>
    </Card>
  );
}
