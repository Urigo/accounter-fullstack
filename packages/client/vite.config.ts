import path from 'node:path';
import { config as dotenv } from 'dotenv';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { clientBuildEnvDefines } from './build-env.js';

// Fills `process.env` for `clientBuildEnvDefines`: `packages/client/.env` first, then the root `.env`.
dotenv({
  path: [`.env`, `../../.env`],
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ['path', 'stream', 'util'],
      exclude: ['http'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      overrides: {
        fs: 'memfs',
      },
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: {
      html2canvas: 'html2canvas-pro',
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 3001,
  },
  build: {
    // Vite's default 500 kB budget measures *uncompressed* output, which is a poor proxy here.
    // Two chunks sit above it for reasons that are not worth splitting further:
    //   - the generated GraphQL documents (`src/gql/graphql.ts`): ~820 kB raw but ~47 kB gzipped,
    //     since document ASTs compress extremely well. It is a single generated module, so it
    //     cannot be split; shrinking it means switching codegen to `documentMode: 'string'`.
    //   - the jsPDF + html2canvas bundle behind `PrintToPdfButton`: ~650 kB, but it is loaded
    //     on demand and never reaches the initial page load.
    // The limit is kept low enough to still flag a genuine regression.
    chunkSizeWarningLimit: 900,
  },
  optimizeDeps: {
    include: ['react-hook-form'],
    exclude: ['js-big-decimal'],
  },
  // Every env variable the client reads, inlined at build time: see `build-env.ts` and
  // `.env.template`.
  define: clientBuildEnvDefines(),
});
