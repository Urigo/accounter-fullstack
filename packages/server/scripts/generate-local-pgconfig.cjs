import { readFileSync, writeFileSync } from 'node:fs';

var pgconfigPath = 'pgconfig.json';

if (process.env['POSTGRES_SSL'] !== '1') {
  try {
    const data = readFileSync('./pgconfig.json');
    const config = JSON.parse(data);

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
