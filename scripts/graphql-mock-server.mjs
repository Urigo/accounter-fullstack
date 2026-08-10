/* eslint-disable no-undef */

/* eslint-disable no-console */

/**
 * Auto-mocked GraphQL server for frontend-only development.
 *
 * Serves the generated root schema.graphql on the same port/path the client
 * targets in dev (http://localhost:4000/graphql), with every field resolved
 * to plausible fake data. No DB, no Auth0, no backend build required.
 *
 * Usage:
 *   yarn mock:server            # or: node scripts/graphql-mock-server.mjs
 *
 * Prerequisite: run `yarn generate` at least once so schema.graphql exists.
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSchema, isAbstractType } from 'graphql';
import { createYoga } from 'graphql-yoga';
import { addMocksToSchema } from '@graphql-tools/mock';

const PORT = 4000;
const schemaPath = resolve(dirname(fileURLToPath(import.meta.url)), '../schema.graphql');

let sdl;
try {
  sdl = readFileSync(schemaPath, 'utf8');
} catch {
  console.error(`schema.graphql not found at ${schemaPath} — run \`yarn generate\` first.`);
  process.exit(1);
}

const schema = buildSchema(sdl);

let uuidCounter = 0;
const nextUuid = () => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, '0')}`;

const mocks = {
  BigInt: () => 123_456,
  CountryCode: () => 'IL',
  DateTime: () => '2026-01-15T10:30:00.000Z',
  DividendMock: () => 0,
  FileScalar: () => 'https://example.com/mock-document.pdf',
  Rate: () => 0.17,
  TimelessDate: () => '2026-01-15',
  URL: () => 'https://example.com',
  UUID: nextUuid,
  ID: nextUuid,
  Float: () => 1234.56,
  Int: () => 42,
  VatMock: () => 0.17,
};

// For unions/interfaces (e.g. `SomeResult = Payload | CommonError`), always
// resolve to the first non-error concrete type so the UI doesn't randomly
// render error states.
const resolvers = () => {
  const abstractResolvers = {};
  for (const type of Object.values(schema.getTypeMap())) {
    if (!isAbstractType(type) || type.name.startsWith('__')) continue;
    const possible = schema.getPossibleTypes(type);
    const preferred = possible.find(t => !t.name.includes('Error')) ?? possible[0];
    abstractResolvers[type.name] = {
      __resolveType: () => preferred.name,
    };
  }
  return abstractResolvers;
};

const yoga = createYoga({
  schema: addMocksToSchema({ schema, mocks, resolvers }),
  cors: { origin: '*' },
  landingPage: false,
  graphqlEndpoint: '/graphql',
});

createServer(yoga).listen(PORT, () => {
  console.log(`🎭 Mock GraphQL server ready at http://localhost:${PORT}/graphql`);
});
