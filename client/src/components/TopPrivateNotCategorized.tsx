import { FC, useEffect, useState } from 'react';
import { currencyCodeToSymbol } from '../helpers';
import { useSql } from '../hooks/useSql';
import type { TopPrivateNotCategorizedExpense } from '../models/types';

export const TopPrivateNotCategorized: FC = () => {
  const { getTopPrivateNotCategorized } = useSql();
  const [topPrivateNotCategorizedExpenses, setTopPrivateNotCategorizedExpenses] = useState<
    TopPrivateNotCategorizedExpense[]
  >([]);

  useEffect(() => {
    getTopPrivateNotCategorized().then(setTopPrivateNotCategorizedExpenses);
  }, []);

  return topPrivateNotCategorizedExpenses ? (
    <>
      <h1>Top uncategorized private expenses</h1>

      <table>
        <thead>
          <tr>
            <th>amount</th>
            <th>description</th>
            <th>date</th>
          </tr>
        </thead>
        <tbody>
          {topPrivateNotCategorizedExpenses.map(row => (
            <tr>
              <td>
                {row.amount}
                {currencyCodeToSymbol(row.currency_code)}
              </td>
              <td>{row.bank_description}</td>
              <td>
                {new Intl.DateTimeFormat('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }).format(new Date(row.date))}
              </td>
              <td>{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  ) : null;
};
