import { CSSProperties } from 'react';

import { writeToClipboard } from '../../../helpers/clipboard';
import type { TransactionType } from '../../../models/types';
import { UpdateButton } from '../../common';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const Links = ({ transaction, style }: Props) => {
  return (
    <td style={{ ...style }}>
      {transaction.links && 'yes'}
      <UpdateButton transaction={transaction} propertyName="links" promptText="New links:" />
      <button type="button" onClick={() => writeToClipboard(transaction.links ?? '')}>
        &#9986;
      </button>
    </td>
  );
};
