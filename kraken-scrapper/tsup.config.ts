import { defineConfig } from 'tsup';

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  sourcemap: true,
  clean: true,
  bundle: true,
  format: 'esm',
  entry: ['src/index.ts'],
});
