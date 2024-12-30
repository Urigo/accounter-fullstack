import { readFileSync, writeFileSync } from 'node:fs';
import { config as appConfig } from '../src/env.ts';

let pgconfigPath = 'pgconfig.json';

if (appConfig?.database?.ssl !== true) {
  try {
    const data = readFileSync('./pgconfig.json');
    const config = JSON.parse(data as unknown as string);

    if (config?.db?.ssl) {
      delete config.db.ssl;
    }

    writeFileSync('./pgconfig.local.json', JSON.stringify(config, null, 2), 'utf8');

    pgconfigPath = 'pgconfig.local.json';
  } catch (err) {
    console.error(err);
    /* empty */
  }
}

console.log(pgconfigPath);
