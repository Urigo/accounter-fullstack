---
'@accounter/client': patch
---

Make the client's GraphQL endpoint configurable via `GRAPHQL_URL`.

`getUrqlClient` picked its endpoint from a `switch` over `import.meta.env.MODE` with three hardcoded
URLs, so the only way to point the client somewhere else was to edit the source. That rules out
preview deploys, branch environments, and running a local client against a non-local backend.

`GRAPHQL_URL` now wins when set, and the per-`MODE` defaults are unchanged otherwise — an existing
`.env` needs no edit.

It follows the convention already in `vite.config.ts` rather than the more obvious one: env vars are
declared **unprefixed** in `.env` and mapped into `import.meta.env.VITE_*` through `define`, the same
way `AUTH0_DOMAIN` becomes `VITE_AUTH0_DOMAIN`. `.env.template` contains no `VITE_` entries at all.

Two details worth keeping: the `define` uses `JSON.stringify(process.env.GRAPHQL_URL ?? '')`, because
an unset var would otherwise inline the literal `undefined` into the bundle; and the client tests for
a non-empty trimmed value rather than for the key being defined, because `define` substitutes an
empty string rather than leaving the key absent.
