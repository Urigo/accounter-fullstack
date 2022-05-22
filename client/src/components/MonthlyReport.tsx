import { FC, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseMonth, parseYear } from '../helpers';
import { useSql } from '../hooks/useSql';
import type { MonthTaxReport } from '../models/types';

export const MonthlyReport: FC = () => {
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

      <table>
        <thead>
          <tr>
            <th>invoice_date</th>
            <th>debit_account_1</th>
            <th>debit_amount_1</th>
            <th>foreign_debit_amount_1</th>
            <th>currency</th>
            <th>credit_account_1</th>
            <th>credit_amount_1</th>
            <th>foreign_credit_amount_1</th>
            <th>debit_account_2</th>
            <th>debit_amount_2</th>
            <th>foreign_debit_amount_2</th>
            <th>credit_account_2</th>
            <th>credit_amount_2</th>
            <th>foreign_credit_amount_2</th>
            <th>details</th>
            <th>reference_1</th>
            <th>reference_2</th>
            <th>movement_type</th>
            <th>value_date</th>
            <th>date_3</th>
          </tr>
        </thead>
        <tbody>
          {monthlyTaxesReport.map(row => (
            <tr>
              <td>{row.invoice_date}</td>
              <td>{row.debit_account_1}</td>
              <td>{row.debit_amount_1}</td>
              <td>{row.foreign_debit_amount_1}</td>
              <td>{row.currency}</td>
              <td>{row.credit_account_1}</td>
              <td>{row.credit_amount_1}</td>
              <td>{row.foreign_credit_amount_1}</td>
              <td>{row.debit_account_2}</td>
              <td>{row.debit_amount_2}</td>
              <td>{row.foreign_debit_amount_2}</td>
              <td>{row.credit_account_2}</td>
              <td>{row.credit_amount_2}</td>
              <td>{row.foreign_credit_amount_2}</td>
              <td>{row.details}</td>
              <td>{row.reference_1}</td>
              <td>{row.reference_2}</td>
              <td>{row.movement_type}</td>
              <td>{row.value_date}</td>
              <td>{row.date_3}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};
