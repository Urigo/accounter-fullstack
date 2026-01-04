import type { ReactElement } from 'react';
import type { DocumentsTableRowType } from '../columns.js';

type Props = {
  document: DocumentsTableRowType;
};

export const Remarks = ({ document }: Props): ReactElement => {
  return (
    <div className="flex flex-col justify-center whitespace-normal">
      <p>{document.remarks}</p>
    </div>
  );
};
