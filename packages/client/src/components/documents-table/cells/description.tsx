import { ReactElement } from 'react';
import { DocumentsTableRowType } from '../columns.jsx';

type Props = {
  document: DocumentsTableRowType;
};

export const Description = ({ document }: Props): ReactElement => {
  let description = '';
  if ('issuedDocumentInfo' in document && document.issuedDocumentInfo?.originalDocument?.income) {
    const { income } = document.issuedDocumentInfo.originalDocument;
    description = income.map(item => item.description).join(', ');
  }
  return (
    <div className="flex flex-col align-center justify-center flex-wrap">
      <p>{description}</p>
    </div>
  );
};
