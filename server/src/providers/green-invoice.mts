import { init, Sdk } from '@accounter-toolkit/green-invoice-graphql';

const id = process.env['GREEN_INVOICE_ID'] as string;
const secret = process.env['GREEN_INVOICE_SECRET'] as string;

let app: Sdk;

async function start() {
  try {
    if (!app) {
      app = (await init(id, secret)).sdk;
      console.log('Green Invoice SDK initialized');
    }
  } catch (err) {
    console.error(`Green Invoice initiation error:\n${err}`);
  }
}
start();

export { app as GreenInvoice };
