import { printSomething } from './anotherFile';
console.log('hello world');
printSomething('new string from function in another file');
// Node says that when importing from commonjs you only can bring 
// const pg = require('pg'); // That works is we change Typescript and Node to use regular commonjs
// import * as pg from 'pg'; // Won't work as this does equal this that:
import pg from 'pg';
const { Pool } = pg;
import { readFileSync, createReadStream } from 'fs';
import { createServer } from 'http';
async function financialStatus() {
    const pool = new Pool({
        user: "postgres",
        host: "localhost",
        database: "accounter",
        password: "accounter123",
        port: 5432
    });
    const currentVATStatusQuery = readFileSync('src/sql/currentVATStatus.sql').toString();
    // second bonus is to try to move this into Top level await
    let currentVATStatus = await pool.query(currentVATStatusQuery);
    const getVATTransactionsQuery = `
    SELECT *
    FROM get_vat_from_date('2020-01-01', '2020-01-31');  
  `;
    let VATTransactions = await pool.query(getVATTransactionsQuery);
    let VATTransactionsString = '';
    for (const transaction of VATTransactions.rows) {
        VATTransactionsString = VATTransactionsString.concat(`
    <tr>
      <td>${transaction.overall_vat_status}</td>
      <td>${transaction.vat}</td>
      <td>${transaction.event_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')}</td>
      <td>${transaction.event_amount}</td>
      <td>${transaction.financial_entity}</td>
      <td>${transaction.user_description}</td>
    </tr>
    `);
    }
    VATTransactionsString = `
    <table>
      <thead>
          <tr>
              <th>Overall VAT Status</th>
              <th>VAT</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Entity</th>
              <th>Description</th>
          </tr>
      </thead>
      <tbody>
          ${VATTransactionsString}
      </tbody>
    </table>  
  `;
    const allTransactionsQuery = readFileSync('src/sql/allTransactions.sql').toString();
    // second bonus is to try to move this into Top level await
    let allTransactions = await pool.query(allTransactionsQuery);
    let allTransactionsString = '';
    for (const transaction of allTransactions.rows) {
        let currencySymbol = '₪';
        if (transaction.currency_code == 'USD') {
            currencySymbol = '$';
        }
        else if (transaction.currency_code == 'EUR') {
            currencySymbol = '€';
        }
        allTransactionsString = allTransactionsString.concat(`
    <tr bank_reference=${transaction.bank_reference}
        account_number=${transaction.account_number}
        account_type=${transaction.account_type}
        currency_code=${transaction.currency_code}
        event_date=${transaction.event_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')}
        event_amount=${transaction.event_amount}
        event_number=${transaction.event_number}>
      <td>${transaction.formatted_event_date}</td>
      <td>${transaction.event_amount}${currencySymbol}</td>
      <td class="financial_entity" onClick='printElement(this, prompt("New financial entity:"));'>${transaction.financial_entity}</td>
      <td class="user_description" onClick='printElement(this, prompt("New user description:"));'>${transaction.user_description}</td>
      <td class="personal_category" onClick='printElement(this, prompt("New personal category:"));'>${transaction.personal_category}</td>
      <td>${transaction.vat}</td>
      <td>${transaction.account_number}${transaction.account_type}</td>
      <td>${transaction.tax_category}</td>
      <td>${transaction.tax_invoice_number}</td>
      <td>${transaction.bank_description}</td>
    </tr>
    `);
    }
    allTransactionsString = `
    <table>
      <thead>
          <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Entity</th>
              <th>Description</th>
              <th>Category</th>
              <th>VAT</th>
              <th>Account</th>
              <th>Tax category</th>
              <th>Invoice Number</th>
              <th>Bank Description</th>
          </tr>
      </thead>
      <tbody>
          ${allTransactionsString}
      </tbody>
    </table>  
  `;
    return `
    <h1>Hello World</h1>

    <div> Current VAT balance ₪${currentVATStatus.rows[0].vat_status} </div>
    
    <h3>VAT Transactions for this month:</h3>

    ${VATTransactionsString}

    <h3>All Transactions</h3>

    ${allTransactionsString}

    <script type="module" src="/browser.js"></script>
    <script type="module">
      import { printElement } from '/browser.js';

      window.printElement = printElement;
    </script>
  `;
}
async function main() {
    const server = createServer(async function (request, response) {
        console.log(request.url);
        if (request.url == '/') {
            response.statusCode = 200;
            response.setHeader('content-type', 'text/html; charset=utf-8');
            let responseHTML = await financialStatus();
            response.end(responseHTML);
        }
        else if (request.url == '/browser.js') {
            response.statusCode = 200;
            response.setHeader('content-type', 'text/javascript; charset=utf-8');
            var readStream = createReadStream('dist/browser/browser.js', 'utf8');
            readStream.pipe(response);
        }
        else if (request.url == '/browser.js.map') {
            response.statusCode = 200;
            response.setHeader('content-type', 'application/octet-stream');
            var readStream = createReadStream('dist/browser/browser.js.map', 'utf8');
            readStream.pipe(response);
        }
        else if (request.url == '/src/browser/browser.ts') {
            response.statusCode = 200;
            response.setHeader('content-type', 'application/x-typescript');
            var readStream = createReadStream('src/browser/browser.ts', 'utf8');
            readStream.pipe(response);
        }
        else if (request.url == '/editProperty') {
            response.statusCode = 200;
            response.setHeader('content-type', 'application/x-typescript');
            const chunks = [];
            request.on('data', chunk => chunks.push(chunk));
            request.on('end', async () => {
                const bufferData = Buffer.concat(chunks);
                const data = JSON.parse(bufferData.toString());
                console.log('Data: ', data);
                let tableToUpdate = 'isracard_creditcard_transactions';
                let accountType = 'card';
                let idType = 'voucher_number';
                // switch (data.account_type)  {
                //   case 'creditcard':
                //   }
                const editPropertyQuery = `
          UPDATE accounter_schema.${tableToUpdate}
          SET ${data.propertyToChange} = '${data.newValue}'
          WHERE ${accountType} = ${parseInt(data.account_number)} AND 
                ${idType} = ${parseInt(data.event_number)};
        `;
                const pool = new Pool({
                    user: "postgres",
                    host: "localhost",
                    database: "accounter",
                    password: "accounter123",
                    port: 5432
                });
                console.log(editPropertyQuery);
                let updateResult = await pool.query(editPropertyQuery);
                console.log(JSON.stringify(updateResult));
            });
        }
    });
    server.listen(3000, () => {
        console.log('server is listening');
    });
}
main()
    .catch(e => console.error(e));
// TODO: Teach about HTML query selectors
// TODO: Teach about plain Node server without frameworks
// TODO: Teach about plain Node server without frameworks how to respond to different URLs
// TODO: Teach how to stream files to browser
// TODO: Teach how to send source maps to browser
// TODO: Teach how to send original Typescript files to browser for debugging
// TODO: Teach how to load module tags in browser
// TODO: Teach how to import from module tags and why it doesn't work unless to put it on window (scoping)
// TODO: Teach how to put identity data on attributes and then call events with parent element
// TODO: Types of HTMLElement
// TODO: Editor configurations
// TODO: Get parent element
//# sourceMappingURL=index.js.map