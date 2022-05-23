import { useEffect, useState } from 'react';
import { formatCurrency } from '../../helpers/currency';
import { useSql } from '../../hooks/useSql';
import type { ThisMonthPrivateExpensesType } from '../../models/types';
import { AccounterBasicTable } from '../common/AccounterBasicTable';

export const ThisMonthPrivateExpensesTable = () => {
  const { getThisMonthPrivateExpenses } = useSql();
  const [thisMonthPrivateExpenses, setThisMonthPrivateExpenses] = useState<ThisMonthPrivateExpensesType[]>([]);

  useEffect(() => {
    getThisMonthPrivateExpenses().then(setThisMonthPrivateExpenses);
  }, []);

  return (
    thisMonthPrivateExpenses.length > 0 && (
      <AccounterBasicTable
        content={
          <>
            <tbody>
              <tr>
                <th>Personal Category</th>
                <th>Amount</th>
              </tr>
              {thisMonthPrivateExpenses.map((row, i) => (
                <tr key={i}>
                  <td>{row.personal_category}</td>
                  <td>{formatCurrency.format(row.overall_sum)}</td>
                </tr>
              ))}
            </tbody>
          </>
        }
      />
    )
  );
};
