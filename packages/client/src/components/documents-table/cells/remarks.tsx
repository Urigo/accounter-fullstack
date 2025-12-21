import type { ReactElement } from 'react';
import type { DocumentsTableRowType } from '../columns.js';

type Props = {
  document: DocumentsTableRowType;
};

export const Remarks = ({ document }: Props): ReactElement => {
  return (
    <div className="flex flex-col align-center justify-center flex-wrap">
      <p>{document.remarks}</p>
    </div>
  );
};
