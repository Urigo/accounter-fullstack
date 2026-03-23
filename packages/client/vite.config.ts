import path from 'node:path';
import { config as dotenv } from 'dotenv';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
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
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    allowedHosts: true,
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
    'import.meta.env.VITE_AUTH0_DOMAIN': JSON.stringify(process.env.AUTH0_DOMAIN),
    'import.meta.env.VITE_AUTH0_FRONTEND_CLIENT_ID': JSON.stringify(
      process.env.AUTH0_FRONTEND_CLIENT_ID,
    ),
    'import.meta.env.VITE_AUTH0_AUDIENCE': JSON.stringify(process.env.AUTH0_AUDIENCE),
  },
});
