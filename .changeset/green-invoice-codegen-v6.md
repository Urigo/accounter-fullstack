---
'@accounter/green-invoice-graphql': minor
---

Generate the SDK with GraphQL Code Generator v6 (`typescript` 6, `typescript-operations` 6). Schema
types now live in their own generated module (still re-exported from the package root), and operation
result types follow the v6 nullability rules: a nullable field is typed `T | null` and is always
present, instead of optional (`field?: T | null`).
