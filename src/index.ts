import { createReadStream } from 'fs';
import { createServer } from 'http';
import { parse } from 'url';
import { reportToReview } from './reportsForReview/reportsToReview';
import { printSomething } from './anotherFile';
import { financialStatus, tableStyles } from './firstPage';
import { monthlyReport } from './taxMonthlyReport/monthlyReportPage';
import { topPrivateNotCategorized } from './privateCharts/privateCharts';

import dotenv from 'dotenv';
const { config } = dotenv;
config();

// Node says that when importing from commonjs you only can bring
// const pg = require('pg'); // That works is we change Typescript and Node to use regular commonjs
// import * as pg from 'pg'; // Won't work as this does equal this that:
import pg from 'pg';
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
  const server = createServer(async function (request, response) {
    console.log('create server?');
    console.log(request.url);
    if (
      request.url == '/' ||
      (request.url && request.url.startsWith('/?month='))
    ) {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      const url_parts = parse(request.url, true);
      const query = url_parts.query;
      let responseHTML = await financialStatus(query);
      response.end(responseHTML);
    } else if (
      request.url == '/monthly-report' ||
      (request.url && request.url.startsWith('/monthly-report?month='))
    ) {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      const url_parts = parse(request.url, true);
      const query = url_parts.query;
      let responseHTML = await monthlyReport(query);
      response.end(responseHTML);
    } else if (
      request.url == '/reports-to-review' ||
      (request.url && request.url.startsWith('/reports-to-review?month='))
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
      let responseHTML = await reportToReview(query);
      response.end(responseHTML);
    } else if (request.url == '/private-charts') {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      let responseHTML = await topPrivateNotCategorized();
      response.end(responseHTML);
    } else if (request.url == '/browser.js') {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/javascript; charset=utf-8');
      var readStream = createReadStream('dist/browser/browser.js', 'utf8');
      readStream.pipe(response);
    } else if (request.url == '/browser.js.map') {
      response.statusCode = 200;
      response.setHeader('content-type', 'application/octet-stream');
      var readStream = createReadStream('dist/browser/browser.js.map', 'utf8');
      readStream.pipe(response);
    } else if (request.url == '/src/browser/browser.ts') {
      response.statusCode = 200;
      response.setHeader('content-type', 'application/x-typescript');
      var readStream = createReadStream('src/browser/browser.ts', 'utf8');
      readStream.pipe(response);
    } else if (request.url == '/editProperty') {
      console.log('new edit');
      response.statusCode = 200;
      response.setHeader('content-type', 'application/x-typescript');
      const chunks: Array<Uint8Array> = [];
      request.on('data', (chunk) => chunks.push(chunk));
      request.on('end', async () => {
        const bufferData = Buffer.concat(chunks);
        const data = JSON.parse(bufferData.toString());
        console.log('Data: ', data);

        let tableToUpdate = 'isracard_creditcard_transactions';
        switch (data.account_type) {
          case 'checking_ils':
            tableToUpdate = 'poalim_ils_account_transactions';
            break;
          case 'checking_usd':
            tableToUpdate = 'poalim_usd_account_transactions';
            break;
          case 'checking_eur':
            tableToUpdate = 'poalim_eur_account_transactions';
            break;
          case 'creditcard':
            tableToUpdate = 'isracard_creditcard_transactions';
            break;
          default:
            console.error(`Unknown account types ${data.account_type}`);
        }

        const editPropertyQuery = `
          UPDATE accounter_schema.${tableToUpdate}
          SET ${data.propertyToChange} = '${data.newValue}'
          WHERE id = '${data.id}'
          RETURNING ${data.propertyToChange};
        `;

        console.log(editPropertyQuery);
        try {
          let updateResult = await pool.query(editPropertyQuery);
          console.log(JSON.stringify(updateResult));
          response.end(JSON.stringify(updateResult));
        } catch (error) {
          // TODO: Log important checks
          console.log('error in insert - ', error);
          response.end(error);

          // console.log('nothing');
        }
      });
    } else if (request.url == '/reviewTransaction') {
      console.log('new review');
      response.statusCode = 200;
      response.setHeader('content-type', 'application/x-typescript');
      const chunks: Array<Uint8Array> = [];
      request.on('data', (chunk) => chunks.push(chunk));
      request.on('end', async () => {
        const bufferData = Buffer.concat(chunks);
        const data = JSON.parse(bufferData.toString());
        console.log('Data: ', data);

        let tableToUpdate = 'saved_tax_reports_2020_03_04_05_06_07_08_09';
        if (data.accountType) {
          if (data.accountType == 'עוש1') {
            tableToUpdate = 'poalim_usd_account_transactions';
          } else if (data.accountType == 'עוש2') {
            tableToUpdate = 'poalim_eur_account_transactions';
          } else if (data.accountType == 'עוש') {
            tableToUpdate = 'poalim_ils_account_transactions';
          } else if (data.accountType == 'כא') {
            tableToUpdate = 'isracard_creditcard_transactions';
          }
        }

        const submitReviewQuery = `
          UPDATE accounter_schema.${tableToUpdate}
          SET reviewed = ${data.reviewed}
          WHERE id = '${data.id}' 
          RETURNING *;
        `;

        console.log(submitReviewQuery);
        try {
          let updateResult = await pool.query(submitReviewQuery);
          console.log(JSON.stringify(updateResult));
          response.end(JSON.stringify(updateResult));
        } catch (error) {
          // TODO: Log important checks
          console.log('error in review submission - ', error);
          response.end(error);

          // console.log('nothing');
        }
      });
    } else if (request.url == '/generateTaxMovements') {
      console.log('new generateTaxMovements');
      response.statusCode = 200;
      response.setHeader('content-type', 'application/x-typescript');
      const chunks: Array<Uint8Array> = [];
      request.on('data', (chunk) => chunks.push(chunk));
      request.on('end', async () => {
        const bufferData = Buffer.concat(chunks);
        const data = JSON.parse(bufferData.toString());
        console.log('Data: ', data);

        const editPropertyQuery = `
          insert into accounter_schema.saved_tax_reports_2020_03_04_05_06_07_08_09
          select * from get_tax_report_of_transaction('${data.transactionId}')
          returning *;
        `;

        console.log(editPropertyQuery);
        try {
          let updateResult = await pool.query(editPropertyQuery);
          console.log(JSON.stringify(updateResult));
          response.end(JSON.stringify(updateResult));
        } catch (error) {
          // TODO: Log important checks
          console.log('error in insert - ', error);
          response.end(error);

          // console.log('nothing');
        }
      });
    } else {
      return response.end();
    }
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log('server is listening');
  });
}

main().catch((e) => console.error(e));

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
