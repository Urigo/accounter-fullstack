import { config } from 'dotenv';
import { init } from '../index.js';

config({ path: '../../.env' });

const testRun = async () => {
  const authToken = process.env['PAYPER_MESH_AUTH_TOKEN'] as string;
  const userName = process.env['PAYPER_MESH_USER_NAME'] as string;
  const app = await init(authToken, userName);

  const data = await app.sdk.getExpenses_query();
  if (!data.getExpenses?.expenses) {
    throw new Error(data.getExpenses?.description);
  }
  console.log(data.getExpenses.expenses.map(e => e?.provider + ' - ' + e?.file_name));
};

testRun().catch(e => {
  console.error(e);
  process.exit(1);
});
