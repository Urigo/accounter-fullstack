import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseMonth, parseYear } from '../helpers';
import { useSql } from '../hooks/use-sql';
import type { MonthTaxReport } from '../models/types';
import { AccounterTable } from './common/accounter-table';

export const MonthlyReport = () => {
  const [searchParams] = useSearchParams();
  const { getMonthlyTaxesReport } = useSql();
  const [monthlyTaxesReport, setMonthlyTaxesReport] = useState<MonthTaxReport[]>([]);

  const month = searchParams.get('month');
  const year = searchParams.get('year');

  const parsedMonth = month ? parseMonth(month) : '10';
  const parsedYear = year ? parseYear(year) : '2020';

  const monthTaxReport = `${parsedYear}-${parsedMonth}-01`;
  console.log('monthTaxReport', monthTaxReport);

  useEffect(() => {
    getMonthlyTaxesReport(monthTaxReport).then(setMonthlyTaxesReport);
  }, []);

  return (
    <>
      <h1>Monthly Report</h1>
      <AccounterTable
        items={monthlyTaxesReport}
        columns={[
          { title: 'invoice_date', value: row => row.invoice_date },
          { title: 'debit_account_1 ', value: row => row.debit_account_1 },
          { title: 'debit_amount_1 ', value: row => row.debit_amount_1 },
          { title: 'foreign_debit_amount_1 ', value: row => row.foreign_debit_amount_1 },
          { title: 'currency ', value: row => row.currency },
          { title: 'credit_account_1 ', value: row => row.credit_account_1 },
          { title: 'credit_amount_1 ', value: row => row.credit_amount_1 },
          { title: 'foreign_credit_amount_1 ', value: row => row.foreign_credit_amount_1 },
          { title: 'debit_account_2 ', value: row => row.debit_account_2 },
          { title: 'debit_amount_2 ', value: row => row.debit_amount_2 },
          { title: 'foreign_debit_amount_2 ', value: row => row.foreign_debit_amount_2 },
          { title: 'credit_account_2 ', value: row => row.credit_account_2 },
          { title: 'credit_amount_2 ', value: row => row.credit_amount_2 },
          { title: 'foreign_credit_amount_2 ', value: row => row.foreign_credit_amount_2 },
          { title: 'details ', value: row => row.details },
          { title: 'reference_1 ', value: row => row.reference_1 },
          { title: 'reference_2 ', value: row => row.reference_2 },
          { title: 'movement_type ', value: row => row.movement_type },
          { title: 'value_date ', value: row => row.value_date },
          { title: 'date_3 ', value: row => row.date_3 },
        ]}
      />
    </>
  );
};
