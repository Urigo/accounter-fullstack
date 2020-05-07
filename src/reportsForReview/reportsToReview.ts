import { pool } from '../index';
import { tableStyles } from '../firstPage';

export const reportToReview = async (query: any): Promise<string> => {
  let reportMonthToReview;
  if (!query) {
    reportMonthToReview = '3';
  }

  console.log('reportMonthToReview', reportMonthToReview);

  let reportToReview = await pool.query(
    `
    select *
    from accounter_schema.saved_tax_reports_2020_0344
    order by to_date(תאריך_3, 'DD/MM/YYYY'), original_id, פרטים, חשבון_חובה_1;
    `
  );

  let counter = 1;
  let reportToReviewHTMLTemplate = '';
  for (const transaction of reportToReview.rows) {
    reportToReviewHTMLTemplate = reportToReviewHTMLTemplate.concat(`
      <tr ${
        transaction.חשבון_חובה_1 && transaction.חשבון_חובה_1.startsWith('BANK')
          ? 'style="background-color: #a68613;"'
          : ''
      }>
        <td>${counter++}</td>
        <td>
          <input onchange="changeConfirmation('${
            transaction.id
          }', this);" type="checkbox" 
          id="${transaction.id}" ${transaction.reviewed ? 'checked' : ''}>
        </td>
        <td>${transaction.תאריך_חשבונית}</td>
        <td>${transaction.חשבון_חובה_1 ? transaction.חשבון_חובה_1 : ''}</td>
        <td>${transaction.סכום_חובה_1 ? transaction.סכום_חובה_1 : ''}</td>
        <td>${
          transaction.מטח_סכום_חובה_1 ? transaction.מטח_סכום_חובה_1 : ''
        }</td>
        <td>${transaction.מטבע ? transaction.מטבע : ''}</td>
        <td>${transaction.חשבון_זכות_1 ? transaction.חשבון_זכות_1 : ''}</td>
        <td>${transaction.סכום_זכות_1 ? transaction.סכום_זכות_1 : ''}</td>
        <td>${
          transaction.מטח_סכום_זכות_1 ? transaction.מטח_סכום_זכות_1 : ''
        }</td>
        <td>${transaction.חשבון_חובה_2 ? transaction.חשבון_חובה_2 : ''}</td>
        <td>${transaction.סכום_חובה_2 ? transaction.סכום_חובה_2 : ''}</td>
        <td>${
          transaction.מטח_סכום_חובה_2 ? transaction.מטח_סכום_חובה_2 : ''
        }</td>
        <td>${transaction.חשבון_זכות_2 ? transaction.חשבון_זכות_2 : ''}</td>
        <td>${transaction.סכום_זכות_2 ? transaction.סכום_זכות_2 : ''}</td>
        <td>${
          transaction.מטח_סכום_זכות_2 ? transaction.מטח_סכום_זכות_2 : ''
        }</td>
        <td>${transaction.פרטים ? transaction.פרטים : ''}</td>
        <td>${transaction.אסמכתא_1 ? transaction.אסמכתא_1 : ''}</td>
        <td>${transaction.אסמכתא_2 ? transaction.אסמכתא_2 : ''}</td>
        <td>${transaction.סוג_תנועה ? transaction.סוג_תנועה : ''}</td>
        <td>${transaction.תאריך_ערך}</td>
        <td>${transaction.תאריך_3 ? transaction.תאריך_3 : ''}</td>
      </tr>
      `);
  }
  reportToReviewHTMLTemplate = `
      <table>
        <thead>
            <tr>
                <th>מספר</th>
                <th>תקין</th>
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
            ${reportToReviewHTMLTemplate}
        </tbody>
      </table>  
    `;

  return `
      ${tableStyles}

      <h1>Report to review</h1>

      ${reportToReviewHTMLTemplate}

      <script type="module" src="/browser.js"></script>
      <script type="module">
        import { changeConfirmation } from '/browser.js';
  
        window.changeConfirmation = changeConfirmation;
      </script>
    `;
};
