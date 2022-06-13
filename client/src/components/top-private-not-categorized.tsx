import { useEffect, useState } from 'react';
import { currencyCodeToSymbol } from '../helpers';
import { useSql } from '../hooks/use-sql';
import type { TopPrivateNotCategorizedExpense } from '../models/types';
import { AccounterTable } from './common/accounter-table';

export const TopPrivateNotCategorized = () => {
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

      <AccounterTable
        items={topPrivateNotCategorizedExpenses}
        columns={[
          {
            title: 'amount',
            value: row => row.amount + currencyCodeToSymbol(row.currency_code),
          },
          { title: 'description ', value: row => row.bank_description },
          { title: 'date ', value: row => row.description },
        ]}
      />
    </>
  ) : null;
};
