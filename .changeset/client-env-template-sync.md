---
'@accounter/client': patch
---

`packages/client/.env.template` now documents every environment variable the client reads, and
`build-env.ts` is the single map from each one to the `import.meta.env.VITE_*` name it is inlined
as (the built bundle is unchanged). Client-only variables (`AUTH0_FRONTEND_CLIENT_ID`, `GRAPHQL_URL`)
moved out of the root template; shared ones (`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`) stay in the root
`.env` and are commented out in the client template so a copied `.env` no longer shadows them. A
test keeps the map, the template and `vite-env.d.ts` in sync.
