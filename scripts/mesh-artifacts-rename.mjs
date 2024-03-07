/* eslint-disable no-undef */

/* eslint-disable no-console */
import * as fs from 'node:fs';
import { globSync } from 'glob';

const rename = async () => {
  const start = new Date().getTime();

  function success() {
    const end = new Date().getTime();
    console.log(`Successfully renamed the directory (${end - start}ms)`);
  }

  return new Promise((resolve, reject) => {
    const defaultName = '.mesh';
    const newName = 'mesh-artifacts';

    const matches = globSync('**/.mesh/**/*.ts');

    if (matches.length > 0) {
      Promise.all(matches.map(m => replacePaths(m, newName)))
        .then(() => {
          const basePathsWithDuplicates = matches.map(match => match.split('.mesh')[0]);
          const basePaths = [...new Set(basePathsWithDuplicates)];

          basePaths.map(path =>
            fs.rename(`${path}${defaultName}`, `${path}${newName}`, err => {
              if (err) {
                reject(err);
                return;
              }
            }),
          );
          success();
          resolve(undefined);
        })
        .catch(reject);
    } else {
      console.log('No ".mesh" folder found');
      success();
    }
  });
};

function replacePaths(path, newName) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      }

      if (data.includes('.mesh')) {
        const result = data
          .replace(/\.mesh/g, newName) // rename mentions of artifacts folder
          .replace(/fileType: "ts"/g, 'fileType: "js"') // for post-bundle fileType
          .replace(/schemaWithAnnotations/g, 'schemaWithAnnotations.js'); // for post-bundle fileType

        fs.writeFile(path, result, 'utf8', err => {
          if (err) {
            reject(err);
          } else {
            resolve(undefined);
          }
        });
      } else {
        resolve(undefined);
      }
    });
  });
}

function run(promise) {
  promise
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

run(rename());
