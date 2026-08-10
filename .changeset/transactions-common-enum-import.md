---
'@accounter/server': patch
---

Import `TransactionDirection` in `transactions/resolvers/common.ts` from `shared/enums.js` instead
of from `__generated__/types.js`.

The generated module only re-exports the enum from `shared/enums.js`, but it is a build artifact —
so a *value* import of it (unlike the `import type` used everywhere else) made this module, and
every test that reaches it, fail to resolve whenever GraphQL codegen had not produced
`packages/server/src/__generated__/types.ts`:

```
Cannot find module '../../../__generated__/types.js' imported from
  packages/server/src/modules/transactions/resolvers/common.ts
```

Behavior is unchanged — it is the same enum object — and this was the only runtime import of the
generated types in the server package.
