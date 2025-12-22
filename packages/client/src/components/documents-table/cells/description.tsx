import type { ReactElement } from 'react';
import type { DocumentsTableRowType } from '../columns.jsx';

type Props = {
  document: DocumentsTableRowType;
};

export const Description = ({ document }: Props): ReactElement => {
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
  return (
    <div className="flex flex-col align-center justify-center flex-wrap">
      <p>{description}</p>
    </div>
  );
};
