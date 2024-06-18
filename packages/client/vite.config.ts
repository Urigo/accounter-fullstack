import { config as dotenv } from 'dotenv';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

dotenv({
  path: '../../.env',
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
