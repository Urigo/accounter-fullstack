import { createReadStream } from 'fs';
import { createServer } from 'http';
import { parse } from 'url';
import dotenv from 'dotenv';
// Node says that when importing from commonjs you only can bring
// const pg = require('pg'); // That works is we change Typescript and Node to use regular commonjs
// import * as pg from 'pg'; // Won't work as this does equal this that:
import pg from 'pg';
import { printSomething } from './another-file.js';
import { financialStatus, tableStyles } from './first-page.js';
import { topPrivateNotCategorized } from './private-charts/private-charts.js';
import { reportToReview } from './reports-for-review/reports-to-review.js';
import { monthlyReport } from './tax-monthly-report/monthly-report-page.js';
import { createTaxEntriesForTransaction } from './tax-monthly-report/taxes-for-transaction.js';
import { updateBankTransactionAttribute } from './tax-monthly-report/update-transactions.js';
import { getAllUsers } from './users/get-all-users.js';
import { userTransactions } from './users/user-transactions.js';

const { config } = dotenv;
config();

const { Pool } = pg;

console.log('hello world');

printSomething('new string from function in another file');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function main() {
  const server = createServer(async (request, response) => {
    console.log(`new request ${request.url}`);
    if (request.url == '/' || (request.url && request.url.startsWith('/?month='))) {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      const url_parts = parse(request.url, true);
      const query = url_parts.query;
      const responseHTML = await financialStatus(query);
      response.end(responseHTML);
    } else if (
      request.url == '/monthly-report' ||
      (request.url && request.url.startsWith('/monthly-report?month='))
    ) {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      const url_parts = parse(request.url, true);
      const query = url_parts.query;
      const responseHTML = await monthlyReport(query);
      response.end(responseHTML);
    } else if (
      request.url == '/reports-to-review' ||
      (request.url && request.url.startsWith('/reports-to-review?month=')) ||
      (request.url && request.url.startsWith('/reports-to-review?company='))
    ) {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      const url_parts = parse(request.url, true);
      const query = url_parts.query;
      response.write(`
        ${tableStyles}
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
          height: 90%;
        }
        .invoiceDate:hover .invoiceImage {
          display: block;
        }
        td .editor {
          visibility: hidden;
          width: 120px;
          background-color: black;
          color: #fff;
          text-align: center;
          border-radius: 6px;
          padding: 5px 0;

          /* Position the tooltip */
          position: absolute;
          z-index: 1;
        }
        td:hover .editor {
          visibility: visible;
        }
        .editButton {
          display: none;
          position: absolute;
          height: 90%;
        }
        .bank-transaction:hover .editButton {
          display: block;
        }

        tr.selected {
          background-color: coral;
        }
        tr.bank-transaction.selected {
          background-color: coral;
        }
        tr.bank-transaction {
          background-color: #a68613;
        }
      </style>
      <h1>Loading...</h1>
      `);
      const responseHTML = await reportToReview(query);
      response.end(responseHTML);
    } else if (request.url == '/private-charts') {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      const responseHTML = await topPrivateNotCategorized();
      response.end(responseHTML);
    } else if (request.url == '/browser.js') {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/javascript; charset=utf-8');
      const readStream = createReadStream('dist/old-accounter/src/browser/browser.js', 'utf8');
      readStream.pipe(response);
    } else if (request.url == '/browser.js.map') {
      response.statusCode = 200;
      response.setHeader('content-type', 'application/octet-stream');
      const readStream = createReadStream('dist/old-accounter/src/browser/browser.js.map', 'utf8');
      readStream.pipe(response);
    } else if (request.url == '/src/browser/browser.ts') {
      response.statusCode = 200;
      response.setHeader('content-type', 'application/x-typescript');
      const readStream = createReadStream('src/browser/browser.ts', 'utf8');
      readStream.pipe(response);
    } else if (request.url == '/editProperty') {
      console.log('new edit');
      response.statusCode = 200;
      response.setHeader('content-type', 'application/x-typescript');
      const chunks: Array<Uint8Array> = [];
      request.on('data', chunk => chunks.push(chunk));
      request.on('end', async () => {
        const bufferData = Buffer.concat(chunks);
        const data = JSON.parse(bufferData.toString());
        console.log('Data: ', data);

        const editPropertyQuery = `
          UPDATE accounter_schema.all_transactions
          SET ${data.propertyToChange} = '${data.newValue}'
          WHERE id = '${data.id}'
          RETURNING ${data.propertyToChange};
        `;

        console.log(editPropertyQuery);
        if (data.newValue) {
          try {
            const updateResult = await pool.query(editPropertyQuery);
            console.log(JSON.stringify(updateResult));
            response.end(JSON.stringify(updateResult));
          } catch (error) {
            // TODO: Log important checks
            console.log('error in insert - ', error);
            response.end(JSON.stringify(error));

            // console.log('nothing');
          }
        }
      });
    } else if (request.url == '/reviewTransaction') {
      console.log('new review');
      response.statusCode = 200;
      response.setHeader('content-type', 'application/x-typescript');
      const chunks: Array<Uint8Array> = [];
      request.on('data', chunk => chunks.push(chunk));
      request.on('end', async () => {
        const bufferData = Buffer.concat(chunks);
        const data = JSON.parse(bufferData.toString());
        console.log('Data: ', data);

        let tableToUpdate = 'ledger';
        if (data.accountType) {
          tableToUpdate = 'all_transactions';
        }

        const submitReviewQuery = `
          UPDATE accounter_schema.${tableToUpdate}
          SET reviewed = ${data.reviewed}
          WHERE id = '${data.id}' 
          RETURNING *;
        `;

        console.log(submitReviewQuery);
        try {
          const updateResult = await pool.query(submitReviewQuery);
          console.log(JSON.stringify(updateResult));
          response.end(JSON.stringify(updateResult));
        } catch (error) {
          // TODO: Log important checks
          console.log('error in review submission - ', error);
          response.end('error in review submission');

          // console.log('nothing');
        }
      });
    } else if (request.url == '/generateTaxMovements') {
      console.log('new generateTaxMovements');
      response.statusCode = 200;
      response.setHeader('content-type', 'application/x-typescript');
      const chunks: Array<Uint8Array> = [];
      request.on('data', chunk => chunks.push(chunk));
      request.on('end', async () => {
        const bufferData = Buffer.concat(chunks);
        const data = JSON.parse(bufferData.toString());
        console.log('Data: ', data);

        /*
                  Movement for the bank
                  Movement for the entity
                  Movement for VAT
        */

        const result = await createTaxEntriesForTransaction(data.transactionId);

        console.log(result);

        response.end(JSON.stringify(result));

        // const editPropertyQuery = `
        //   insert into accounter_schema.ledger
        //   select * from get_tax_report_of_transaction('${data.transactionId}')
        //   returning *;
        // `;

        // console.log(editPropertyQuery);
        // try {
        //   let updateResult = await pool.query(editPropertyQuery);
        //   console.log(JSON.stringify(updateResult));
        //   response.end(JSON.stringify(updateResult));
        // } catch (error) {
        //   // TODO: Log important checks
        //   console.log('error in insert - ', error);
        //   response.end(error);

        //   // console.log('nothing');
        // }
      });
    } else if (request.url == '/editTransactionAttribute') {
      console.log('new editTransactionAttribute');
      response.statusCode = 200;
      response.setHeader('content-type', 'application/x-typescript');
      const chunks: Array<Uint8Array> = [];
      request.on('data', chunk => chunks.push(chunk));
      request.on('end', async () => {
        const bufferData = Buffer.concat(chunks);
        const data = JSON.parse(bufferData.toString());
        console.log('Data: ', data);

        const result = await updateBankTransactionAttribute(
          data.transactionId,
          data.attribute,
          data.value,
        );

        console.log(result);

        response.end(JSON.stringify(result));
      });
    } else if (request.url == '/deleteTaxMovements') {
      console.log('new deleteTaxMovements');
      response.statusCode = 200;
      response.setHeader('content-type', 'application/x-typescript');
      const chunks: Array<Uint8Array> = [];
      request.on('data', chunk => chunks.push(chunk));
      request.on('end', async () => {
        const bufferData = Buffer.concat(chunks);
        const data = JSON.parse(bufferData.toString());
        console.log('Data: ', data);

        const editPropertyQuery = `
          delete from accounter_schema.ledger
          where id = '${data.transactionId}'
          returning *;
        `;

        try {
          const updateResult = await pool.query(editPropertyQuery);
          console.log(JSON.stringify(updateResult));
          response.end(JSON.stringify(updateResult));
        } catch (error) {
          // TODO: Log important checks
          console.log('error in insert - ', error);
          response.end(error);

          // console.log('nothing');
        }
      });
    } else if (
      request.url == '/user-transactions' ||
      (request.url && request.url.startsWith('/user-transactions?'))
    ) {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      const url_parts = parse(request.url, true);
      const query = url_parts.query;
      const responseHTML = await userTransactions(query);
      response.end(responseHTML);
    } else if (request.url == '/all-users') {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      const responseHTML = await getAllUsers();
      response.end(responseHTML);
    } else {
      return response.end();
    }
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log('server is listening');
  });
}

main().catch(e => console.error(e));

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
