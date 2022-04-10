import { FC } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseMonth, parseYear } from '../helpers';
import { useSql } from '../hooks/useSql';

export const MonthlyReport: FC = () => {
  const [searchParams] = useSearchParams();
  const { getMonthlyTaxesReport } = useSql();

  const month = searchParams.get('month');
  const year = searchParams.get('year');

  const parsedMonth = month ? parseMonth(month) : '10';
  const parsedYear = year ? parseYear(year) : '2020';

  const monthTaxReport = `${parsedYear}-${parsedMonth}-01`;
  console.log('monthTaxReport', monthTaxReport);

  const monthlyTaxesReport = getMonthlyTaxesReport(monthTaxReport);

  return (
    <>
      <h1>Monthly Report</h1>

      <table>
        <thead>
          <tr>
            <th>תאריך_חשבונית</th>
            <th>חשבון_חובה_1</th>
            <th>סכום_חובה_1</th>
            <th>מטח_סכום_חובה_1</th>
            <th>מטבע</th>
            <th>חשבון_זכות_1</th>
            <th>סכום_זכות_1</th>
            <th>מטח_סכום_זכות_1</th>
            <th>חשבון_חובה_2</th>
            <th>סכום_חובה_2</th>
            <th>מטח_סכום_חובה_2</th>
            <th>חשבון_זכות_2</th>
            <th>סכום_זכות_2</th>
            <th>מטח_סכום_זכות_2</th>
            <th>פרטים</th>
            <th>אסמכתא_1</th>
            <th>אסמכתא_2</th>
            <th>סוג_תנועה</th>
            <th>תאריך_ערך</th>
            <th>תאריך_3</th>
          </tr>
        </thead>
        <tbody>
          {monthlyTaxesReport.map((row) => (
            <tr>
              <td>{row.תאריך_חשבונית}</td>
              <td>{row.חשבון_חובה_1}</td>
              <td>{row.סכום_חובה_1}</td>
              <td>{row.מטח_סכום_חובה_1}</td>
              <td>{row.מטבע}</td>
              <td>{row.חשבון_זכות_1}</td>
              <td>{row.סכום_זכות_1}</td>
              <td>{row.מטח_סכום_זכות_1}</td>
              <td>{row.חשבון_חובה_2}</td>
              <td>{row.סכום_חובה_2}</td>
              <td>{row.מטח_סכום_חובה_2}</td>
              <td>{row.חשבון_זכות_2}</td>
              <td>{row.סכום_זכות_2}</td>
              <td>{row.מטח_סכום_זכות_2}</td>
              <td>{row.פרטים}</td>
              <td>{row.אסמכתא_1}</td>
              <td>{row.אסמכתא_2}</td>
              <td>{row.סוג_תנועה}</td>
              <td>{row.תאריך_ערך}</td>
              <td>{row.תאריך_3}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};
