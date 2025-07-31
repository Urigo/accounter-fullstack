import { ReactElement } from 'react';
import { GenerateDocument } from '../../common/documents/issue-document/index.js';
import { PageLayout } from '../../layout/page-layout.js';

export const IssueDocumentScreen = (): ReactElement => {
  return (
    <PageLayout title="New Document" description="Issue a document for a client">
      <GenerateDocument />
    </PageLayout>
  );
};
