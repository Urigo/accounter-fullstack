---
'@accounter/server': patch
---

- **Function Signature Refactor**: The `ledgerGenerationByCharge` function has been refactored from
  a higher-order function that returned another function, to a direct `async` function that accepts
  all its parameters at once.
- **Simplified Call Sites**: All instances where `ledgerGenerationByCharge` was called have been
  updated across various resolvers and reports to reflect its new, simplified signature, removing
  the double-invocation pattern.
- **Improved Type Safety**: The function's return type and parameters have been explicitly defined
  with `Promise<Maybe<ResolverTypeWrapper<CommonError | LedgerRecordsProto>>>` and
  `GraphQLResolveInfo`, enhancing type safety and clarity.
