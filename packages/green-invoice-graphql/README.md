# green-invoice-graphql

> ⚠️ **Frozen.** This package is no longer published to npm (the last published version is `0.8.6`),
> receives no dependency upgrades, and produces no build output of its own. It is still
> **required**: [`@accounter/server`](../server) imports it and compiles it directly from source
> (see `paths` and `include` in `packages/server/tsconfig.json`). Its `build` script now runs only
> the GraphQL-Mesh codegen that the server's compile depends on. Change it only when the server
> needs it to change.

Graphql-Mesh wrapper on top of Green Invoice's APIs

# issues with green invoice

1. on file upload (draft expense) - some details are responded (successful import), but file is
   missing from the drafts search
2. on file upload (draft expense) - an ID is returned. this ID doesn't exist on getExpense. search
   drafts doesn't return IDs. so what is it used for?
3. why is most of the expense data missing on response of searchDrafts?
4. Is there swagger / json schema / postman collection to the entire collection
