import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const scraperServerPort = Number(process.env.PORT ?? 4001);

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${scraperServerPort}`,
        changeOrigin: true,
      },
      '/ws': {
        target: `ws://localhost:${scraperServerPort}`,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist/ui',
    emptyOutDir: true,
  },
});
