import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'graphql';
import { composeServices } from '@theguild/federation-composition';
import { ServiceConfig } from './supergraph.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCHEMA_PATH = join(__dirname, '../../schema.graphql');
const SUPERGRAPH_PATH = join(__dirname, '../../supergraph.graphql');

const LEGACY_SUBGRAPH_URL =
  process.env.LEGACY_SUBGRAPH_URL ?? 'http://localhost:4001/subgraphs/legacy';

async function main(): Promise<void> {
  try {
    const mainSchema = parse(readFileSync(SCHEMA_PATH, 'utf-8'));

    const services: ServiceConfig[] = [
      {
        name: 'legacy',
        typeDefs: mainSchema,
        url: LEGACY_SUBGRAPH_URL,
      },
    ];

    const result = composeServices(services);

    if (result.errors) {
      console.error('Composition errors:', result.errors);
      process.exit(1);
    }

    writeFileSync(SUPERGRAPH_PATH, result.supergraphSdl);
    console.log('✨ Supergraph SDL written to:', SUPERGRAPH_PATH);
  } catch (error) {
    console.error('Failed to generate supergraph:', error);
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Supergraph generation failed:', e);
  process.exit(1);
});
