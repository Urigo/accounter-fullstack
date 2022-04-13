import { FC } from 'react';
import { formatCurrency } from '../../helpers/currency';
import { useSql } from '../../hooks/useSql';

export const ThisMonthPrivateExpensesTable: FC = () => {
  const { getThisMonthPrivateExpenses } = useSql();

  const thisMonthPrivateExpenses = getThisMonthPrivateExpenses();

  return thisMonthPrivateExpenses.length > 0 ? (
    <table>
      <thead>
        <tr>
          <th>Personal Category</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {thisMonthPrivateExpenses.map((row) => (
          <tr>
            <td>{row.personal_category}</td>
            <td>{formatCurrency.format(row.overall_sum)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <div />
  );
};
