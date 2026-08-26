import type { ReactElement } from 'react';
import type { DocumentsTableRowType } from '../columns.js';
import { ExpandableText } from './expandable-text.js';

type Props = {
  document: DocumentsTableRowType;
};

export const Description = ({ document }: Props): ReactElement | null => {
  let description = '';
  if (document.description) {
    description = document.description;
  } else if (
    'issuedDocumentInfo' in document &&
    document.issuedDocumentInfo?.originalDocument?.income
  ) {
    const { income } = document.issuedDocumentInfo.originalDocument;
    description = income.map(item => item.description).join(', ');
  }
  return <ExpandableText text={description} />;
};
