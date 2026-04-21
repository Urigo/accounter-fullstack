import fs from 'node:fs';

function validateEnvExists(): void {
  if (!fs.existsSync('./src/env.ts')) {
    fs.copyFile('./src/env.template.ts', './src/env.ts', err => {
      if (err) throw err;
      console.log('/src/env.ts file was created based on template');
    });
  }
}

validateEnvExists();
