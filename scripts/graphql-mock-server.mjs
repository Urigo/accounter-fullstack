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
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';

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
  // Distinct from the default string, so accepting a suggestion visibly changes the row.
  ChargeSuggestions: () => ({ description: 'Suggested description' }),
  // Every charge misses the two fields a row can fill in from a suggestion, so both in-row
  // edits are there to try.
  ValidationData: () => ({ missingInfo: ['DESCRIPTION', 'TAGS'] }),
};

// For unions/interfaces (e.g. `SomeResult = Payload | CommonError`), always
// resolve to the first non-error concrete type so the UI doesn't randomly
// render error states.
const preferredTypeOf = type => {
  const possible = schema.getPossibleTypes(type);
  return possible.find(t => !t.name.includes('Error')) ?? possible[0];
};

const CHARGE_TYPE = preferredTypeOf(schema.getType('Charge')).name;

const abstractResolvers = {};
for (const type of Object.values(schema.getTypeMap())) {
  if (!isAbstractType(type) || type.name.startsWith('__')) continue;
  const preferred = preferredTypeOf(type);
  abstractResolvers[type.name] = {
    __resolveType: () => preferred.name,
  };
  // The mock store files a value under the concrete type it picks, at random unless told. Tell
  // it the same type the resolver reports, so looking a value up by that type finds it.
  mocks[type.name] = () => ({ __typename: preferred.name });
}

const resolvers = store => {
  return {
    ...abstractResolvers,
    // A charge keeps its id and its edits across requests, as on the real server. Without these,
    // `charge(chargeId)` and the charge mutations each answer with a new random charge, so a row
    // refetch or a client cache has nothing to match the answer to.
    Query: {
      charge: (_, { chargeId }) => store.get(CHARGE_TYPE, chargeId),
    },
    Mutation: {
      updateCharge: (_, { chargeId, fields }) => {
        const validation = store.get(CHARGE_TYPE, chargeId, 'validationData');
        const noLongerMissing = info =>
          store.set(
            validation,
            'missingInfo',
            store.get(validation, 'missingInfo').filter(missing => missing !== info),
          );
        if (fields.userDescription !== undefined) {
          store.set(CHARGE_TYPE, chargeId, 'userDescription', fields.userDescription);
          noLongerMissing('DESCRIPTION');
        }
        if (fields.tags) {
          store.set(
            CHARGE_TYPE,
            chargeId,
            'tags',
            fields.tags.map(tag => store.get('Tag', tag.id)),
          );
          noLongerMissing('TAGS');
        }
        return {
          __typename: 'UpdateChargeSuccessfulResult',
          charge: store.get(CHARGE_TYPE, chargeId),
        };
      },
      updateChargeAccountantApproval: (_, { chargeId, approvalStatus }) => {
        store.set(CHARGE_TYPE, chargeId, 'accountantApproval', approvalStatus);
        return approvalStatus;
      },
    },
  };
};

const yoga = createYoga({
  schema: addMocksToSchema({ schema, mocks, resolvers }),
  cors: { origin: '*' },
  landingPage: false,
  graphqlEndpoint: '/graphql',
  // As on the real server: a query with `@defer` is answered in parts.
  plugins: [useDeferStream()],
});

createServer(yoga).listen(PORT, () => {
  console.log(`🎭 Mock GraphQL server ready at http://localhost:${PORT}/graphql`);
});
