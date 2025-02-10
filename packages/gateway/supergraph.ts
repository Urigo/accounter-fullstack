/* eslint-disable no-console */
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, type DocumentNode } from 'graphql';
import { composeServices } from '@theguild/federation-composition';

// Define paths relative to the script location
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCHEMA_PATH = join(__dirname, '../../schema.graphql');
const SUPERGRAPH_PATH = join(__dirname, '../../supergraph.graphql');

interface ServiceConfig {
  name: string;
  typeDefs: DocumentNode;
  url: string;
}

/**
 * Generates the supergraph SDL file from the schema
 * and starts the gateway server.
 */
function generateSupergraph(): void {
  try {
    const mainSchema = parse(readFileSync(SCHEMA_PATH, 'utf-8'));

    const services: ServiceConfig[] = [
      {
        name: 'legacy',
        typeDefs: mainSchema,
        url: 'https://accounter-federeation.onrender.com/subgraphs/legacy',
      },
    ];

    const result = composeServices(services);

    if (result.errors) {
      console.error('Composition errors:', result.errors);
      process.exit(1);
    } else {
      writeFileSync(SUPERGRAPH_PATH, result.supergraphSdl);
      console.log('✨ Supergraph SDL written to:', SUPERGRAPH_PATH);

      // Start the gateway
      const gateway: ChildProcess = spawn('yarn', ['dev'], {
        stdio: 'inherit',
        shell: true,
      });

      gateway.on('error', (error: Error) => {
        console.error('Failed to start gateway:', error);
      });
    }
  } catch (error) {
    console.error('Failed to generate supergraph:', error);
    process.exit(1);
  }
}

generateSupergraph();
