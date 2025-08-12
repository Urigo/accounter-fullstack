import type { ReactElement } from 'react';

type Props = {
  originalAmount: string;
  diffAmount?: string;
};

export const AmountCell = ({ originalAmount, diffAmount }: Props): ReactElement => {
  if (!diffAmount || originalAmount === diffAmount) {
    return <td>{originalAmount}</td>;
  }

  return (
    <td>
      <div className="flex flex-col">
        <p className={diffAmount ? 'line-through' : ''}>{originalAmount}</p>
        {diffAmount && <div className="border-2 border-yellow-500 rounded-md">{diffAmount}</div>}
      </div>
    </td>
  );
};
