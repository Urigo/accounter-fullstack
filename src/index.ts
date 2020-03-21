import { printSomething } from './anotherFile';
import { financialStatus } from './firstPage';
import { monthlyReport } from './taxMonthlyReport/monthlyReportPage';
import { topPrivateNotCategorized } from './privateCharts/privateCharts';

// Node says that when importing from commonjs you only can bring
// const pg = require('pg'); // That works is we change Typescript and Node to use regular commonjs
// import * as pg from 'pg'; // Won't work as this does equal this that:
import pg from 'pg';
const { Pool } = pg;

console.log('hello world');

printSomething('new string from function in another file');

import { createReadStream } from 'fs';
import { createServer } from 'http';

export const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'accounter',
  password: 'accounter123',
  port: 5432,
});

async function main() {
  const server = createServer(async function(request, response) {
    console.log('create server?');
    console.log(request.url);
    if (request.url == '/') {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      let responseHTML = await financialStatus();
      response.end(responseHTML);
    } else if (request.url == '/monthly-report') {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      let responseHTML = await monthlyReport();
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
      request.on('data', chunk => chunks.push(chunk));
      request.on('end', async () => {
        const bufferData = Buffer.concat(chunks);
        const data = JSON.parse(bufferData.toString());
        console.log('Data: ', data);

        let tableToUpdate = 'isracard_creditcard_transactions';
        let accountType = 'card';
        let idType = 'voucher_number';
        let whereClause = '';
        switch (data.account_type) {
          case 'checking_ils':
            tableToUpdate = 'poalim_ils_account_transactions';
            accountType = 'account_number';
            whereClause = `expanded_event_date = ${parseInt(
              data.event_number
            )} and reference_number = ${data.bank_reference}
            and event_amount = ${Math.abs(parseFloat(data.event_amount))}`;
            break;
          case 'checking_usd':
            tableToUpdate = 'poalim_usd_account_transactions';
            accountType = 'account_number';
            whereClause = `event_number = ${parseInt(
              data.event_number
            )} and reference_number = ${parseInt(data.bank_reference)}
            and event_amount = ${Math.abs(parseFloat(data.event_amount))}`;
            break;
          case 'checking_eur':
            tableToUpdate = 'poalim_eur_account_transactions';
            accountType = 'account_number';
            whereClause = `event_number = ${parseInt(
              data.event_number
            )} and reference_number = ${parseInt(data.bank_reference)}
            and event_amount = ${Math.abs(parseFloat(data.event_amount))}`;
            break;
          case 'creditcard':
            tableToUpdate = 'isracard_creditcard_transactions';
            accountType = 'card';
            idType = 'voucher_number';
            whereClause = `${idType} = ${parseInt(data.event_number)}`;
            break;
          default:
            console.error(`Unknown account types ${data.account_type}`);
        }

        const editPropertyQuery = `
          UPDATE accounter_schema.${tableToUpdate}
          SET ${data.propertyToChange} = '${data.newValue}'
          WHERE ${accountType} = ${parseInt(data.account_number)} AND 
                ${whereClause}
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
    }
  });

  server.listen(3000, () => {
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
