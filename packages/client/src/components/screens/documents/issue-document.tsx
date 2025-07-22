import { ReactElement } from 'react';
import { GenerateDocument } from '../../common/documents/issue-document/index.js';
import { PageLayout } from '../../layout/page-layout.js';

export const IssueDocumentScreen = (): ReactElement => {
  return (
    <PageLayout title="Documents" description="All documents">
      <GenerateDocument />
    </PageLayout>
  );
};
