import { config } from 'dotenv';
import { init } from '../index.js';

config({ path: [`.env`, `../../.env`] });

const test = async () => {
  const token = process.env['HASHAVSHEVET_AUTH_TOKEN'] as string;
  const key = process.env['HASHAVSHEVET_KEY'] as string;
  const url = process.env['HASHAVSHEVET_URL'] as string;
  const { sdk } = await init(token, key, url);

  const res = await sdk.getSortCodes_query();

  console.log(JSON.stringify(res, null, 2));

  const res2 = await sdk.getCompanies_query();

  console.log(JSON.stringify(res2, null, 2));
};

test();
