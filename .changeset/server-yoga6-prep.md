---
'@accounter/server': patch
---

- Raise the GraphQL request body limit to 50 MB: yoga's 25 MB default rejected gateway ingests
  carrying close to the 20 MB attachment cap (base64-inlined, ~27 MB).
- Build scraper-upload errors with `new GraphQLError` instead of yoga's `createGraphQLError`
  (removed in yoga 6), and pin vitest to `graphql`'s CJS entry so tests see the single `graphql`
  copy production does. This also corrects the email-ingestion control test and comments, which
  assumed yoga masks that resolver's `GraphQLError` — it never did in production. Since that error
  does reach the gateway, it no longer carries the underlying database error (`extensions.cause`),
  whose `detail`/`where` can hold row values and SQL; it stays in the server log.
- Import the auth plugin's `Plugin` type from `graphql-yoga` rather than the undeclared
  `@envelop/types`.
- Remove the unused `@envelop/generic-auth` dependency.
