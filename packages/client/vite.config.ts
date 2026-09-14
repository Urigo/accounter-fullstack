import path from 'node:path';
import { config as dotenv } from 'dotenv';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

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
  define: {
    'import.meta.env.VITE_AUTH0_DOMAIN': JSON.stringify(process.env.AUTH0_DOMAIN),
    'import.meta.env.VITE_AUTH0_FRONTEND_CLIENT_ID': JSON.stringify(
      process.env.AUTH0_FRONTEND_CLIENT_ID,
    ),
    'import.meta.env.VITE_AUTH0_AUDIENCE': JSON.stringify(process.env.AUTH0_AUDIENCE),
    // `?? ''` rather than a bare stringify: an unset var would otherwise inline
    // the literal `undefined` into the bundle instead of a value the client can
    // test for.
    'import.meta.env.VITE_GRAPHQL_URL': JSON.stringify(process.env.GRAPHQL_URL ?? ''),
    'import.meta.env.VITE_DEV_AUTH': JSON.stringify(process.env.ALLOW_DEV_AUTH),
    'import.meta.env.VITE_DEV_AUTH_USER_ID': JSON.stringify(process.env.DEV_AUTH_USER_ID),
  },
});
