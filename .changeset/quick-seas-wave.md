---
'@accounter/server': patch
---

- Replace `new URL('.', import.meta.url).pathname` with
  `fileURLToPath(new URL('.', import.meta.url))` everywhere it's used to resolve `__dirname` in ESM.
- `.pathname` breaks on Windows (prepends an extra leading slash before the drive letter, e.g.
  `/C:/...`) and doesn't decode URL-encoded characters (e.g. `%20` for spaces). `fileURLToPath` from
  the built-in `url` module is the standard, cross-platform way to do this.
- Applied across all 34 GraphQL server modules' `index.ts` files, the root and server
  `vitest.config.ts`, and the `graphql-module` skill's scaffold template (so newly generated modules
  follow the same convention).
