import { config as dotenv } from 'dotenv';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
// @ts-expect-error Missing type definitions for tailwindcss
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

dotenv({
  path: '../../.env',
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
    },
  },
  server: {
    port: 3001,
  },
  optimizeDeps: {
    include: ['react-hook-form'],
    exclude: ['js-big-decimal'],
  },
  build: {
    commonjsOptions: {
      include: [/react-hook-form/, /node_modules/],
    },
  },
  define: {
    'import.meta.env.DEFAULT_FINANCIAL_ENTITY_ID': JSON.stringify(
      process.env.DEFAULT_FINANCIAL_ENTITY_ID,
    ),
  },
});
