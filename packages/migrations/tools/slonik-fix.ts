/* eslint-disable no-console */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

// Dynamically resolve the path to the @slonik/pg-driver using createRequire
const require = createRequire(import.meta.url);

let pgDriverPath;

try {
  pgDriverPath = require.resolve('@slonik/pg-driver');
  pgDriverPath = path.resolve(pgDriverPath, '../');
} catch {
  console.error("❌ @slonik/pg-driver not found. Make sure it's installed.");
  process.exit(1);
}

// Construct the path to the target file
const target = path.join(path.dirname(pgDriverPath), 'dist/factories/createPgDriverFactory.js');

// Check if the target file exists
if (!fs.existsSync(target)) {
  console.error(`❌ Unable to find the target file at: ${target}`);
  process.exit(1);
}

// Read the content of the target file
const content = fs.readFileSync(target, 'utf8');

const tr = `throw new InvalidInputError('Must not use multiple statements in a single query.');`;
if (content.includes(tr)) {
  const newContent = content.replace(
    tr,
    `// was throwing new InvalidInputError('Must not use multiple statements in a single query.');
      result = result[result.length - 1];`,
  );
  fs.writeFileSync(target, newContent);
  console.log('👍 Patched @slonik/pg-driver');
} else {
  console.log('👍 @slonik/pg-driver already patched');
}
