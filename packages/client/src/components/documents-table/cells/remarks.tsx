import type { ReactElement } from 'react';
import type { DocumentsTableRowType } from '../columns.js';
import { ExpandableText } from './expandable-text.js';

type Props = {
  document: DocumentsTableRowType;
};

export const Remarks = ({ document }: Props): ReactElement | null => {
  return <ExpandableText text={document.remarks} />;
};
