import { config } from 'dotenv';
import { init } from '../index.js';

config({ path: `../../.env` });

const testRun = async () => {
  const id = process.env['GREEN_INVOICE_ID'] as string;
  const secret = process.env['GREEN_INVOICE_SECRET'] as string;
  const app = await init(id, secret);

  /* search drafts */
  const data = await app.sdk.searchExpenseDrafts_query();
  if (!data.searchExpenseDrafts) {
    throw new Error('no response data');
  }
  if (!('page' in data.searchExpenseDrafts)) {
    throw new Error(`Got error response: ${data.searchExpenseDrafts.errorMessage ?? undefined}`);
  }
  console.log(
    `Successfully searched, found ${data.searchExpenseDrafts.items?.length ?? 0} expenses.`,
  );
};

testRun().catch(e => {
  console.error(e);
  process.exit(1);
});
