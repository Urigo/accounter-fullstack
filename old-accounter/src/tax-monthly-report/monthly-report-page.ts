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

  const monthlyTaxesReport: any = await pool.query(monthlyTaxesReportSQL, [
    `$$${monthTaxReportDate}$$`,
  ]);

  let monthlyReportsHTMLTemplate = '';
  for (const transaction of monthlyTaxesReport) {
    monthlyReportsHTMLTemplate = monthlyReportsHTMLTemplate.concat(`
      <tr>
        <td>${transaction.invoice_date}</td>
        <td>${transaction.debit_account_1}</td>
        <td>${transaction.debit_amount_1}</td>
        <td>${transaction.foreign_debit_amount_1}</td>
        <td>${transaction.currency}</td>
        <td>${transaction.credit_account_1}</td>
        <td>${transaction.credit_amount_1}</td>
        <td>${transaction.foreign_credit_amount_1}</td>
        <td>${transaction.debit_account_2}</td>
        <td>${transaction.debit_amount_2}</td>
        <td>${transaction.foreign_debit_amount_2}</td>
        <td>${transaction.credit_account_2}</td>
        <td>${transaction.credit_amount_2}</td>
        <td>${transaction.foreign_credit_amount_2}</td>
        <td>${transaction.details}</td>
        <td>${transaction.reference_1}</td>
        <td>${transaction.reference_2}</td>
        <td>${transaction.movement_type}</td>
        <td>${transaction.value_date}</td>
        <td>${transaction.date_3}</td>
      </tr>
      `);
  }
  monthlyReportsHTMLTemplate = `
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
            ${monthlyReportsHTMLTemplate}
        </tbody>
      </table>  
    `;

  return `
      <h1>Monthly Report</h1>

      ${monthlyReportsHTMLTemplate}
    `;
};
