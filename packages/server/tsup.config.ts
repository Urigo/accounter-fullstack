import { defineConfig } from 'tsup';

export default defineConfig({
  sourcemap: true,
  clean: true,
  bundle: true, // Enable bundling to resolve path aliases
  format: 'esm',
  entry: ['src/index.ts'], // Single entry point
  outDir: 'dist',
  target: 'node20',
  external: [
    // External packages that should not be bundled
    '@accounter/green-invoice-graphql',
    '@accounter/pcn874-generator',
    '@accounter/shaam-uniform-format-generator',
    '@accounter/shaam6111-generator',
    // Node.js built-ins
    'graphql-modules',
    'graphql-yoga',
    'graphql',
    'pg',
    'reflect-metadata',
    '@envelop/graphql-modules',
    '@graphql-hive/yoga',
    '@graphql-yoga/plugin-defer-stream',
  ],
});
