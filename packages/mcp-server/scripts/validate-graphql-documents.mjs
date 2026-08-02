#!/usr/bin/env node

/* eslint-disable no-undef */

/* eslint-disable no-console */

/**
 * Validate the MCP server's GraphQL documents against the generated schema.
 *
 * These documents are tagged template literals inside `.ts` files, which nothing
 * else in the repo checks: the root `yarn graphql:validate` runs
 * graphql-inspector over `packages/client` only, graphql-codegen does not read
 * this package, and TypeScript sees the queries as opaque strings. So a
 * misspelled field, a field removed upstream, or a selection on the wrong type
 * compiles, lints, and passes every unit test — the tool suites stub `fetch`,
 * so they never contact a real schema — and fails only at runtime, as a
 * sanitized UPSTREAM_ERROR that does not name the offending field.
 *
 * Exits non-zero on the first invalid document. See gap 8 in
 * docs/connector-gaps-and-decisions.md.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSchema, parse, validate } from 'graphql';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '..', '..');
const SCHEMA_PATH = resolve(REPO_ROOT, 'schema.graphql');

/** Directories holding upstream operations, relative to the package root. */
const SOURCE_DIRS = ['src/tools', 'src/upstream'];

/** Matches the `/* GraphQL *\/` tagged template the codebase uses. */
const DOCUMENT_PATTERN = /\/\* GraphQL \*\/ `([\s\S]*?)`/g;

function loadSchema() {
  // schema.graphql is generated and git-ignored, so a fresh checkout has none.
  // Fail with the command to run rather than a bare ENOENT.
  if (!existsSync(SCHEMA_PATH)) {
    console.error(
      `schema.graphql not found at ${SCHEMA_PATH}.\n` +
        'It is generated and git-ignored — run `yarn generate:graphql` from the repo root first.',
    );
    process.exit(1);
  }
  return buildSchema(readFileSync(SCHEMA_PATH, 'utf8'));
}

/** Every `/* GraphQL *\/` document found under the source directories. */
function collectDocuments() {
  const documents = [];
  for (const dir of SOURCE_DIRS) {
    const absoluteDir = resolve(PACKAGE_ROOT, dir);
    if (!existsSync(absoluteDir)) continue;
    for (const entry of readdirSync(absoluteDir)) {
      if (!entry.endsWith('.ts') || entry.endsWith('.d.ts')) continue;
      const file = join(absoluteDir, entry);
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(DOCUMENT_PATTERN)) {
        const body = match[1];
        const name = body.match(/(?:query|mutation|subscription)\s+(\w+)/)?.[1] ?? '(anonymous)';
        documents.push({ file: relative(REPO_ROOT, file), name, body });
      }
    }
  }
  return documents;
}

const schema = loadSchema();
const documents = collectDocuments();

// An empty result means the pattern stopped matching (e.g. the tag was renamed),
// which would silently turn this check into a no-op.
if (documents.length === 0) {
  console.error(
    `No GraphQL documents found under ${SOURCE_DIRS.join(', ')}. ` +
      'Expected at least one `/* GraphQL */` tagged template — has the tag changed?',
  );
  process.exit(1);
}

let invalid = 0;
for (const document of documents) {
  const label = `${document.file} :: ${document.name}`;
  let errors;
  try {
    errors = validate(schema, parse(document.body));
  } catch (error) {
    // A syntax error throws rather than returning validation errors.
    console.error(`FAIL ${label}\n     ${error.message}`);
    invalid += 1;
    continue;
  }
  if (errors.length > 0) {
    console.error(`FAIL ${label}`);
    for (const error of errors) console.error(`     ${error.message}`);
    invalid += 1;
  } else {
    console.log(`ok   ${label}`);
  }
}

console.log(`\n${documents.length} document(s) checked, ${invalid} invalid`);
process.exit(invalid > 0 ? 1 : 0);
