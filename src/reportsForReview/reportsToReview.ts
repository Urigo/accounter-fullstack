import { pool } from '../index';
import { tableStyles } from '../firstPage';
import { readFileSync } from 'fs';
import moment from 'moment';
// import fetch from 'node-fetch';
// import XML from 'pixl-xml';

export const reportToReview = async (query: any): Promise<string> => {
  let reportMonthToReview;
  if (query.month) {
    reportMonthToReview = `2020-0${query.month}-01`;
  } else {
    reportMonthToReview = `2020-04-01`;
  }

  const lastInvoiceNumbersQuery = readFileSync(
    'src/sql/lastInvoiceNumbers.sql'
  ).toString();
  
  const results: any = await Promise.allSettled([
    pool.query(lastInvoiceNumbersQuery),
    pool.query(
      `
      select *
      from get_unified_tax_report_of_month('${reportMonthToReview}')
      order by to_date(תאריך_3, 'DD/MM/YYYY'), original_id, פרטים, חשבון_חובה_1;
      `
    )
  ]);
  let lastInvoiceNumbers: any = results[0].value;
  let reportToReview: any = results[1].value;

  let lastInvoiceNumbersHTMLTemplate = '';
  for (const transaction of lastInvoiceNumbers.rows) {
    lastInvoiceNumbersHTMLTemplate = lastInvoiceNumbersHTMLTemplate.concat(`
      <tr>
        <td>${transaction.tax_invoice_number}</td>
        <td>${transaction.event_date
          .toISOString()
          .replace(/T/, ' ')
          .replace(/\..+/, '')}</td>
        <td>${transaction.financial_entity}</td>
        <td>${transaction.user_description}</td>
        <td>${transaction.event_amount}</td>
      </tr>
      `);
  }
  lastInvoiceNumbersHTMLTemplate = `
      <table>
        <thead>
            <tr>
              <th>Invoice Number</th>
              <th>Date</th>
              <th>Entity</th>
              <th>Description</th>
              <th>Amount</th>
            </tr>
        </thead>
        <tbody>
            ${lastInvoiceNumbersHTMLTemplate}
        </tbody>
      </table>  
    `;

  console.log('reportMonthToReview', reportMonthToReview);

  let counter = 1;
  let reportToReviewHTMLTemplate = '';
  for (const transaction of reportToReview.rows) {

    let exchangeRate: any = 0;
    if (transaction.תאריך_ערך) {      
      let valueDate = moment(transaction.תאריך_ערך, 
        'DD/MM/YYYY');
  
        exchangeRate = await pool.query(`
        select all_exchange_dates.eur_rate, all_exchange_dates.usd_rate
        from all_exchange_dates
        where all_exchange_dates.exchange_date = '${valueDate.format('YYYY-MM-DD')}'
      `);
    }

    
    // let url = `https://www.boi.org.il/currency.xml?rdate=${valueDate.format(
    //   'YYYYMMDD'
    // )}`;
    // let dailyDollarRate = 0;
    // let dailyEuroRate = 0;
    // await (async () => {
    //   try {
    //     const response = await fetch(url);
    //     let textRes = await response.text();

    //     let currencyRates: any = XML.parse(textRes);

    //     if (currencyRates.CURRENCY) {
    //       dailyDollarRate = currencyRates.CURRENCY.find(
    //         (x: any) => x.CURRENCYCODE === 'USD'
    //       ).RATE;
    //       dailyEuroRate = currencyRates.CURRENCY.find(
    //         (x: any) => x.CURRENCYCODE === 'EUR'
    //       ).RATE;
    //     }
    //   } catch (error) {
    //     console.log(error);
    //   }
    // })();

    reportToReviewHTMLTemplate = reportToReviewHTMLTemplate.concat(`
      <tr ${transaction.פרטים && transaction.פרטים 
          == '0'
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
        <td class="invoiceDate">
          ${transaction.תאריך_חשבונית}
          <img class="invoiceImage" src="${transaction.proforma_invoice_file}">
        </td>
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
        <td class="valueDate">
          ${transaction.תאריך_ערך}
          <div class="valueDateValues">
            USD-${(exchangeRate?.rows) ? exchangeRate?.rows[0]?.usd_rate : 0}
            EUR-${(exchangeRate?.rows) ? exchangeRate?.rows[0]?.eur_rate : 0}
          </div>
        </td>
        <td>${transaction.תאריך_3 ? transaction.תאריך_3 : ''}</td>
      </tr>
      `);
  }
  reportToReviewHTMLTemplate = `
      <style>
        .valueDateValues {
          display: none;
        }
        .valueDate:hover .valueDateValues {
          display: block;
        }
        .invoiceImage {
          display: none;
          position: absolute;
        }
        .invoiceDate:hover .invoiceImage {
          display: block;
        }
      </style>
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

      <h3>Last invoice numbers</h3>
  
      ${lastInvoiceNumbersHTMLTemplate}

      <h1>Report to review</h1>

      ${reportToReviewHTMLTemplate}

      <script type="module" src="/browser.js"></script>
      <script type="module">
        import { changeConfirmation } from '/browser.js';
  
        window.changeConfirmation = changeConfirmation;
      </script>
    `;
};
