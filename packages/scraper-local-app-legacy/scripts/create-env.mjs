import fs from 'node:fs';

function validateEnvExists() {
  if (!fs.existsSync('./src/env.ts')) {
    fs.copyFile('./src/env.template.ts', './src/env.ts', err => {
      if (err) throw err;
      // eslint-disable-next-line no-undef
      console.log('/src/env.ts file was created based on template');
    });
  }
}

validateEnvExists();
