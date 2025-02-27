import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { printSchemaWithDirectives } from '@graphql-tools/utils';
import { env } from './src/environment.js';
import { createGraphQLApp } from './src/modules-app.js';

async function main() {
  console.info('Starting subgraph schema generation...');
  const application = await createGraphQLApp(env);
  const schemaPath = 'legacy-subgraph.graphql';
  writeFileSync(schemaPath, printSchemaWithDirectives(application.schema));
  console.info(`Subgraph schema successfully written to ${schemaPath}`);
}

main().catch(e => {
  console.error('Schema generation failed:', e);
  process.exit(1);
});
