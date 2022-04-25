import { FC, useEffect, useState } from 'react';
import { formatCurrency } from '../../helpers/currency';
import { useSql } from '../../hooks/useSql';
import type { ThisMonthPrivateExpensesType } from '../../models/types';

export const ThisMonthPrivateExpensesTable: FC = () => {
  const { getThisMonthPrivateExpenses } = useSql();
  const [thisMonthPrivateExpenses, setThisMonthPrivateExpenses] = useState<
    ThisMonthPrivateExpensesType[]
  >([]);

  useEffect(() => {
    getThisMonthPrivateExpenses().then(setThisMonthPrivateExpenses);
  }, []);

  return thisMonthPrivateExpenses.length > 0 ? (
    <table>
      <thead>
        <tr>
          <th>Personal Category</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {thisMonthPrivateExpenses.map((row, i) => (
          <tr key={i}>
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
