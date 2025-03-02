import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { watch } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, type DocumentNode } from 'graphql';
import { composeServices } from '@theguild/federation-composition';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCHEMA_PATH = join(__dirname, '../../schema.graphql');
const SUPERGRAPH_PATH = join(__dirname, '../../supergraph.graphql');
const GATEWAY_DIR = join(__dirname, '../');

const LEGACY_SUBGRAPH_URL =
  process.env.LEGACY_SUBGRAPH_URL ?? 'http://localhost:4001/subgraphs/legacy';

let gatewayProcess: ChildProcess | null = null;
let isRestarting = false;

export interface ServiceConfig {
  name: string;
  typeDefs: DocumentNode;
  url: string;
}

async function isPortInUse(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = createServer();
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (await isPortInUse(port)) {
    port++;
  }
  return port;
}

function terminateGateway(): Promise<void> {
  return new Promise(resolve => {
    if (gatewayProcess) {
      console.log('Stopping gateway process...');
      gatewayProcess.on('exit', () => {
        gatewayProcess = null;
        resolve();
      });
      gatewayProcess.kill('SIGTERM');
    } else {
      resolve();
    }
  });
}

async function startGateway(port: number): Promise<void> {
  await terminateGateway();

  console.log(`Starting gateway on port ${port}...`);

  process.env.HIVE_GATEWAY_PORT = port.toString();

  gatewayProcess = spawn('yarn', ['dev'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env },
  });

  gatewayProcess.on('error', (error: Error) => {
    console.error('Failed to start gateway:', error);
  });

  gatewayProcess.on('exit', code => {
    if (code !== 0 && code !== null && !isRestarting) {
      console.error(`Gateway process exited with code ${code}`);
    }
  });
}

async function generateSupergraphWithWatchMode(): Promise<void> {
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

    const port = await findAvailablePort(4000);
    await startGateway(port);
  } catch (error) {
    console.error('Failed to generate supergraph:', error);
    process.exit(1);
  }
}

async function watchGatewayFiles(): Promise<void> {
  try {
    const watcher = watch(GATEWAY_DIR, { recursive: true });

    console.log(`👀 Watching for changes in ${GATEWAY_DIR}`);

    for await (const event of watcher) {
      // Skip node_modules and hidden files
      if (
        event.filename &&
        (event.filename.includes('node_modules') || event.filename.startsWith('.'))
      ) {
        continue;
      }

      // Skip if we're already restarting
      if (isRestarting) {
        continue;
      }

      console.log(`🔄 Change detected in: ${event.filename}`);
      isRestarting = true;

      try {
        await generateSupergraphWithWatchMode();
      } catch (error) {
        console.error('Error while regenerating supergraph:', error);
      }

      isRestarting = false;
    }
  } catch (error) {
    console.error('Watch error:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  await terminateGateway();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await terminateGateway();
  process.exit(0);
});

// Initial setup
console.log('🚀 Starting gateway in watch mode...');
setTimeout(
  () => generateSupergraphWithWatchMode().then(watchGatewayFiles).catch(console.error),
  3000,
);
