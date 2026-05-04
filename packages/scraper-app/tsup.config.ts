import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server/index.ts'],
  outDir: 'dist/server',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  clean: true,
});
