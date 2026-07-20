---
'@accounter/server': minor
'@accounter/gmail-listener': patch
---

Deprecate the legacy gmail-listener email path now that the v2 multi-tenant
`@accounter/email-ingestion-gateway` pipeline (Cloudflare → Gateway → Server) covers it.

- The server GraphQL fields `businessEmailConfig` (query) and `insertEmailDocuments` (mutation) are
  marked `@deprecated` (non-breaking — the legacy listener keeps working for rollback) and scheduled
  for removal after cutover. Their resolvers carry matching `@deprecated` JSDoc.
- `@accounter/gmail-listener` is marked deprecated (README banner + package description) and
  superseded by the gateway. It is kept only for rollback during the cutover.
- Docs updated to acknowledge the migration (root `CLAUDE.md`, `packages/server/CLAUDE.md`).

The `gmail_listener` auth role and the package itself are intentionally retained for rollback; hard
removal (and `npm deprecate` of the published package) is a follow-up once the cutover is complete.
