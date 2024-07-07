import { config as dotenv } from 'dotenv';
import { defineConfig } from 'vite';

import viteReact from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

dotenv({
  path: '../../.env',
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [viteReact(), TanStackRouterVite()],
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
