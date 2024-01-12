import { ReactElement } from 'react';
import { format } from 'date-fns';
import { InsertMiniButton } from '../../common';

interface Props {
  month: string;
  setInsertSalaryRecord: () => void;
}

export const MonthTitleRow = ({ month, setInsertSalaryRecord }: Props): ReactElement => {
  const formattedMonth = format(new Date(month), 'MMMM yyyy');

  return (
    <tr tabIndex={0} className="h-16 rounded">
      <td colSpan={100}>
        <div className="flex justify-between pl-5">
          <p className="text-lg font-bold text-gray-800">{formattedMonth}</p>
          <div className="flex items-center">
            <div className="flex flex-col">
              <InsertMiniButton onClick={setInsertSalaryRecord} />
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
};
