import { defineConfig } from 'tsup';

export default defineConfig({
  sourcemap: true,
  clean: true,
  bundle: true,
  format: 'esm',
  entry: ['src/index.ts'],
});
