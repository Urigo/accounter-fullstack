import type { ReactElement } from 'react';
import { TableCell } from '../../ui/table.js';

type Props = {
  originalAmount: string;
  diffAmount?: string;
};

export const AmountCell = ({ originalAmount, diffAmount }: Props): ReactElement => {
  if (!diffAmount || originalAmount === diffAmount) {
    return <TableCell>{originalAmount}</TableCell>;
  }

  return (
    <TableCell>
      <div className="flex flex-col">
        <p className={diffAmount ? 'line-through' : ''}>{originalAmount}</p>
        {diffAmount && <div className="border-2 border-yellow-500 rounded-md">{diffAmount}</div>}
      </div>
    </TableCell>
  );
};
