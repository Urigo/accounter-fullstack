import { pool } from '../index';
import { readFileSync } from 'fs';
import moment from 'moment';
// import fetch from 'node-fetch';
// import XML from 'pixl-xml';

import { createTaxEntriesForMonth } from '../taxMonthlyReport/taxesForMonth';
import { lastInvoiceNumbersQuery, getLastInvoiceNumbers } from '../firstPage';

export const reportToReview = async (query: any): Promise<string> => {
  let reportMonthToReview;
  let currrentCompany;
  if (query.month) {
    reportMonthToReview = `${query.month}-01`;
  } else {
    reportMonthToReview = `2020-12-01`;
  }

  if (query.company) {
    currrentCompany = query.company;
  } else {
    currrentCompany = 'Software Products Guilda Ltd.';
  }

  console.log('reportMonthToReview', reportMonthToReview);
  console.time('callingReportsDB');
  // let currrentCompany = 'Software Products Guilda Ltd.';
  // currrentCompany = 'Uri Goldshtein LTD';
  const results: any = await Promise.allSettled([
    pool.query(lastInvoiceNumbersQuery),
    // pool.query(
    //   `
    //   select *
    //   from get_unified_tax_report_of_month($$${currrentCompany}$$, '2020-01-01', $$${reportMonthToReview}$$)
    //   order by to_date(תאריך_3, 'DD/MM/YYYY') desc, original_id, פרטים, חשבון_חובה_1, id;
    //   `
    // ),
    pool.query(`
      select *
      from accounter_schema.ledger
      where business = $$6a20aa69-57ff-446e-8d6a-1e96d095e988$$
      order by to_date(תאריך_3, 'DD/MM/YYYY') desc;
      `),
    pool.query(`
      select *
      from accounter_schema.all_transactions
      where account_number in ('466803', '1082', '1074')
      order by event_date desc;
    `),
  ]);
  const lastInvoiceNumbers: any = results[0].value;
  const reportToReview: any = {};
  const allLedger: any = results[1].value;
  const allTransactions: any = results[2].value;

  allTransactions.rows = allTransactions.rows.map((transaction: any) => {
    transaction.תאריך_חשבונית = moment(transaction.event_date).format(
      'DD/MM/YYYY'
    );
    transaction.חשבון_חובה_1 = transaction.account_type
      ? transaction.account_type
      : '';
    transaction.סכום_חובה_1 = `${transaction.event_amount} ${transaction.currency_code}`;
    transaction.מטח_סכום_חובה_1 = transaction.bank_description;
    transaction.מטבע = '';
    transaction.חשבון_זכות_1 = transaction.financial_entity;
    transaction.סכום_זכות_1 = transaction.tax_category;
    transaction.מטח_סכום_זכות_1 = transaction.current_balance;
    transaction.חשבון_חובה_2 =
      transaction.סכום_חובה_2 =
      transaction.מטח_סכום_חובה_2 =
      transaction.חשבון_זכות_2 =
      transaction.סכום_זכות_2 =
        '';
    transaction.מטח_סכום_זכות_2 = transaction.id;
    transaction.פרטים = '0';
    transaction.אסמכתא_1 = transaction.bank_reference;
    transaction.אסמכתא_2 = moment(transaction.tax_invoice_date).format(
      'DD/MM/YYYY'
    );
    transaction.סוג_תנועה = transaction.vat;
    transaction.תאריך_ערך = moment(transaction.debit_date).format('DD/MM/YYYY');
    transaction.תאריך_3 = moment(transaction.event_date).format('DD/MM/YY');
    transaction.original_id = transaction.id;
    transaction.origin = 'bank';
    return transaction;
  });

  reportToReview.rows = allLedger.rows.concat(allTransactions.rows);
  reportToReview.rows.sort((a: any, b: any) => {
    const date1 = moment(a.תאריך_3, 'DD/MM/YYYY').valueOf();
    const date2 = moment(b.תאריך_3, 'DD/MM/YYYY').valueOf();

    if (date1 > date2) {
      return -1;
    } else if (date1 < date2) {
      return 1;
    } else if (a.original_id > b.original_id) {
        return -1;
      } else if (a.original_id < b.original_id) {
        return 1;
      } else {
        return 0;
      }
  });
  // console.log(JSON.stringify(reportToReview.rows));

  console.timeEnd('callingReportsDB');
  console.time('renderReports');

  let counter = 1;
  let reportToReviewHTMLTemplate = '';
  let incomeSum = 0;
  let outcomeSum = 0;
  let VATincome = 0;
  let VAToutcome = 0;
  for (const transaction of reportToReview.rows) {
    if (
      transaction.סכום_חובה_1 &&
      transaction.חשבון_חובה_1 != 'מעמחוז' &&
      transaction.חשבון_חובה_1 != 'עסק' &&
      transaction.פרטים &&
      transaction.פרטים != '0'
    ) {
      if (transaction.סכום_חובה_1) {
        outcomeSum += parseFloat(transaction.סכום_חובה_1);
      }
      if (transaction.סכום_חובה_2) {
        outcomeSum += parseFloat(transaction.סכום_חובה_2);
      }
      if (transaction.סכום_זכות_1) {
        incomeSum += parseFloat(transaction.סכום_זכות_1);
      }
      if (transaction.סכום_זכות_2) {
        incomeSum += parseFloat(transaction.סכום_זכות_2);
      }

      if (transaction.סכום_חובה_2) {
        VAToutcome += parseFloat(transaction.סכום_חובה_2);
      }
      if (transaction.סכום_זכות_2) {
        VATincome += parseFloat(transaction.סכום_זכות_2);
      }
    }

    // let exchangeRate: any = 0;
    // if (transaction.תאריך_ערך) {
    //   let valueDate = moment(transaction.תאריך_ערך, 'DD/MM/YYYY');

    //   exchangeRate = await pool.query(`
    //     select all_exchange_dates.eur_rate, all_exchange_dates.usd_rate
    //     from all_exchange_dates
    //     where all_exchange_dates.exchange_date = '${valueDate.format(
    //       'YYYY-MM-DD'
    //     )}'
    //   `);
    // }

    const generateTaxFunctionCall = `onClick='generateTaxMovements("${transaction.id}");'`;
    const sendToHashavshevetFunctionCall = `onClick='sendToHashavshevet("${transaction.id}");'`;
    const generateGoToUserTransactionsFunctionCall = (
      userName?: string | null
    ) => {
      if (!userName) {
        return '';
      }
      return `<a href='/user-transactions?name=${userName}'>${userName}</a>`;
    };
    const movementOrBank = transaction.פרטים && transaction.פרטים == '0';
    const addHoverEditButton = (
      attribute: string,
      viewableHtml?: string
    ): string => {
      const elementId = `${attribute}-${transaction.id}`;
      const content = viewableHtml || transaction[attribute] || '';
      return content;
      if (movementOrBank) {
        return content;
      }

      return `
      ${content}
      <div class="editor">
        <input type="text" id="${elementId}" value="${transaction[attribute]}">
        <br>
        <button onclick='editTransactionAttribute("${movementOrBank}", "${transaction.id}", "${attribute}", document.getElementById("${elementId}").value)'>Execute</button>
      </div>`;
    };
    const missingHashavshevetSync =
      (movementOrBank &&
        !transaction.hashavshevet_id &&
        transaction.חשבון_חובה_1 != 'כא') ||
      (!movementOrBank && !transaction.hashavshevet_id);

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
      <tr ${
        movementOrBank ? 'class="bank-transaction"' : ''
      } onClick='setSelected(this);'>
        <td>${counter++}</td>
        <td>
          <input onchange="changeConfirmation('${transaction.id}', this${
      movementOrBank ? ", '" + transaction.חשבון_חובה_1 + "'" : ''
    });" type="checkbox" 
          id="${transaction.id}" ${transaction.reviewed ? 'checked' : ''}>
        </td>
        <td class="invoiceDate">
          ${addHoverEditButton('תאריך_חשבונית')}
          <img download class="invoiceImage" src="${
            transaction.proforma_invoice_file
          }">
        </td>
        <td>${addHoverEditButton(
          'חשבון_חובה_1',
          generateGoToUserTransactionsFunctionCall(transaction.חשבון_חובה_1)
        )}</td>
        <td>${addHoverEditButton('סכום_חובה_1')}</td>
        <td>${addHoverEditButton('מטח_סכום_חובה_1')}</td>
        <td>${addHoverEditButton('מטבע')}</td>
        <td>${addHoverEditButton(
          'חשבון_זכות_1',
          generateGoToUserTransactionsFunctionCall(transaction.חשבון_זכות_1)
        )}</td>
        <td>${addHoverEditButton('סכום_זכות_1')}</td>
        <td>${addHoverEditButton('מטח_סכום_זכות_1')}</td>
        <td>${addHoverEditButton(
          'חשבון_חובה_2',
          generateGoToUserTransactionsFunctionCall(transaction.חשבון_חובה_2)
        )}</td>
        <td>${addHoverEditButton('סכום_חובה_2')}</td>
        <td>${addHoverEditButton('מטח_סכום_חובה_2')}</td>
        <td>${addHoverEditButton(
          'חשבון_זכות_2',
          generateGoToUserTransactionsFunctionCall(transaction.חשבון_זכות_2)
        )}</td>
        <td>${addHoverEditButton('סכום_זכות_2')}</td>
        <td>${addHoverEditButton('מטח_סכום_זכות_2')}</td>
        <td>${addHoverEditButton('פרטים')}</td>
        <td>${addHoverEditButton('אסמכתא_1')}</td>
        <td>${addHoverEditButton('אסמכתא_2')}</td>
        <td>${addHoverEditButton('סוג_תנועה')}</td>
        <td class="valueDate">
          ${addHoverEditButton('תאריך_ערך')}
          <div class="valueDateValues">
          </div>
        </td>
        <td>${addHoverEditButton('תאריך_3')}</td>
        <td ${
          missingHashavshevetSync
            ? 'style="background-color: rgb(255,0,0);"'
            : ''
        }>
          ${transaction.hashavshevet_id ? transaction.hashavshevet_id : ''}
        <button type="button"
          ${
            movementOrBank
              ? generateTaxFunctionCall
              : sendToHashavshevetFunctionCall
          }>e
        </button>
        ${
          movementOrBank
            ? ''
            : `<button type="button" onClick='deleteTaxMovements("${transaction.id}");'>D</button>`
        }
        </td>
      </tr>
      `);
  }
  reportToReviewHTMLTemplate = `
      <div>
      סהכ סכום חובה  :  <br>
      ${(Math.round(outcomeSum * 100) / 100).toFixed(2)}
      </div>
      <div>
      סהכ סכום זכות  :  <br>
      ${(Math.round(incomeSum * 100) / 100).toFixed(2)}
      </div>

      <div>
     2סהכ חובה  : <br>
      ${(Math.round(VAToutcome * 100) / 100).toFixed(2)}
      </div>
      <div>
     2סהכ זכות  :  <br>
     ${(Math.round(VATincome * 100) / 100).toFixed(2)}
      </div>
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
                <th>חשבשבת</th>
            </tr>
        </thead>
        <tbody>
            ${reportToReviewHTMLTemplate}
        </tbody>
      </table>  
    `;

  console.timeEnd('renderReports');

  const taxReportHTML = await createTaxEntriesForMonth(
    moment(reportMonthToReview, 'YYYY-MM-DD').toDate(),
    currrentCompany,
    pool
  );

  return `
      <script type="module" src="/browser.js"></script>
      <script type="module">
        import { changeConfirmation, setSelected, generateTaxMovements, deleteTaxMovements, editTransactionAttribute } from '/browser.js';

        window.changeConfirmation = changeConfirmation;
        window.setSelected = setSelected;
        window.generateTaxMovements = generateTaxMovements;
        window.deleteTaxMovements = deleteTaxMovements;
        window.editTransactionAttribute = editTransactionAttribute;
      </script>

      ${taxReportHTML.monthTaxHTMLTemplate}
      <br>
      ${taxReportHTML.overallMonthTaxHTMLTemplate}
      <br>
      ${taxReportHTML.monthVATReportHTMLTemplate}
      <br>
      Left transactions:
      ${taxReportHTML.leftMonthVATReportHTMLTemplate}
      <br>
      ${taxReportHTML.overallVATHTMLTemplate}
      <br>
      <h3>Last invoice numbers</h3>
  
      ${getLastInvoiceNumbers(lastInvoiceNumbers)}

      <h1>Report to review</h1>

      ${reportToReviewHTMLTemplate}
    `;
};
