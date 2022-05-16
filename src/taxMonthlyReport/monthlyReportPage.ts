import { pool } from '../index';

export const monthlyReport = async (query: any): Promise<string> => {
  let monthTaxReportDate;
  if (query.month) {
    // TODO: Fix this stupid month calculation
    monthTaxReportDate = `2020-0${query.month}-01`;
  } else {
    monthTaxReportDate = '2020-10-01';
  }
  console.log('monthTaxReportDate', monthTaxReportDate);

  const monthlyTaxesReportSQL = `
    select *
    from get_tax_report_of_month($monthTaxReportDate);
  `;

  const monthlyTaxesReport: any = await pool.query(monthlyTaxesReportSQL, [`$$${monthTaxReportDate}$$`]);

  let monthlyReportsHTMLTemplate = '';
  for (const transaction of monthlyTaxesReport) {
    monthlyReportsHTMLTemplate = monthlyReportsHTMLTemplate.concat(`
      <tr>
        <td>${transaction.תאריך_חשבונית}</td>
        <td>${transaction.חשבון_חובה_1}</td>
        <td>${transaction.סכום_חובה_1}</td>
        <td>${transaction.מטח_סכום_חובה_1}</td>
        <td>${transaction.מטבע}</td>
        <td>${transaction.חשבון_זכות_1}</td>
        <td>${transaction.סכום_זכות_1}</td>
        <td>${transaction.מטח_סכום_זכות_1}</td>
        <td>${transaction.חשבון_חובה_2}</td>
        <td>${transaction.סכום_חובה_2}</td>
        <td>${transaction.מטח_סכום_חובה_2}</td>
        <td>${transaction.חשבון_זכות_2}</td>
        <td>${transaction.סכום_זכות_2}</td>
        <td>${transaction.מטח_סכום_זכות_2}</td>
        <td>${transaction.פרטים}</td>
        <td>${transaction.אסמכתא_1}</td>
        <td>${transaction.אסמכתא_2}</td>
        <td>${transaction.סוג_תנועה}</td>
        <td>${transaction.תאריך_ערך}</td>
        <td>${transaction.תאריך_3}</td>
      </tr>
      `);
  }
  monthlyReportsHTMLTemplate = `
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
            ${monthlyReportsHTMLTemplate}
        </tbody>
      </table>  
    `;

  return `
      <h1>Monthly Report</h1>

      ${monthlyReportsHTMLTemplate}
    `;
};
