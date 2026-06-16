# Release Checklist — Multi-tenant Email Ingestion v2

## Wiring Audit (S20)

The following audit was performed against the code at the time of this checklist. Re-run before any
major change to the providers or resolvers.

### Provider scope and DB boundary

| Provider                            | Scope             | DB client               | Rationale                                                                                                                                                                                    |
| ----------------------------------- | ----------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EmailIngestionControlProvider`     | `Scope.Singleton` | `DBProvider` (raw pool) | Alias resolution and grant issuance happen before any tenant context exists; `TenantAwareDBClient` would throw `UNAUTHENTICATED`                                                             |
| `EmailIngestionIdempotencyProvider` | `Scope.Operation` | `TenantAwareDBClient`   | Tenant identity is established by the time idempotency/dedup writes run; RLS `WITH CHECK` provides defense-in-depth against cross-tenant writes                                              |
| `EmailIngestionIngestProvider`      | `Scope.Singleton` | `DBProvider` (raw pool) | Gateway presents a `gateway_control_plane` token with no `businessId`; tenant isolation enforced via explicit `owner_id` parameters on every query and RLS policies on the underlying tables |

**Result**: ✅ DBProvider/raw-pool access is limited to control-plane paths. `Scope.Operation` +
`TenantAwareDBClient` is used for all tenant-bound idempotency and dedup operations.

### Gateway → server operations

| Operation                             | Mutation               | Role required           |
| ------------------------------------- | ---------------------- | ----------------------- |
| Tenant resolution + grant issuance    | `requestIngestControl` | `gateway_control_plane` |
| Document ingest                       | `ingestEmail`          | `gateway_control_plane` |
| Legacy compatibility (gmail_listener) | `insertEmailDocuments` | `gmail_listener`        |

**Result**: ✅ The gateway targets `requestIngestControl` and `ingestEmail` exclusively. It does not
call the legacy `insertEmailDocuments` mutation. Role isolation is enforced at the GraphQL schema
level via `@requiresRole(role: "gateway_control_plane")`.

### No cross-package runtime imports

```bash
# Run this check before any merge to the gateway package
grep -rn 'from.*packages/gmail-listener\|require.*packages/gmail-listener' \
  packages/email-ingestion-gateway/src/
# Expected: no output
```

**Result**: ✅ The gateway package imports only from its own `src/` directory, `graphql-request`,
and Node built-ins. No runtime imports from `packages/gmail-listener`.

### Legacy compatibility bridge

`packages/server/src/modules/gmail-listener/` is a thin re-export shim:

```typescript
// index.ts
export {
  emailIngestionModule as gmailListenerModule,
  CommonTypes
} from '../email-ingestion/index.js'
// types.ts
export type * from '../email-ingestion/types.js'
```

It contains no logic. The legacy listener package (`packages/gmail-listener`) continues to work
through this shim until it is decommissioned.

### End-to-end idempotency/dedup/quarantine flow

The live ingest path in `EmailIngestionIngestProvider.performIngest()` enforces this sequence:

1. **Grant validation** — `validateAndConsumeGrant` in `EmailIngestionControlProvider` (atomic
   single-use consume with `consumed_at`).
2. **Idempotency check** — `email_ingestion_idempotency_keys` lookup; returns prior result on hit.
3. **Dedup fingerprint check** — `email_ingestion_dedup_fingerprints` lookup; returns duplicate
   result on hit.
4. **Quarantine** — `email_ingestion_quarantine` insert if no documents were extracted
   (`NO_DOCUMENTS`).
5. **Insert** — idempotency and dedup records written atomically; ingest_id returned.

**Result**: ✅ All four control-flow legs (INSERTED, DUPLICATE, QUARANTINED, REJECTED) are exercised
by unit tests in
`packages/server/src/modules/email-ingestion/__tests__/email-ingestion-ingest.provider.test.ts`.

---

## Pre-deployment Checklist

### Code and type safety

- [ ] `yarn generate` — codegen completes with no errors and no diff in committed generated files.
- [ ] `yarn lint` — zero lint errors in `packages/email-ingestion-gateway` and
      `packages/server/src/modules/email-ingestion`.
- [ ] TypeScript strict mode passes (`yarn workspace @accounter/server typecheck` and
      `yarn workspace @accounter/email-ingestion-gateway typecheck`).

### Tests

- [ ] `yarn test` — all unit tests pass (198 gateway tests, server unit tests).
- [ ] `yarn test:integration` — integration tests pass (requires running PostgreSQL with migrations
      applied).
- [ ] No skipped or `.only` tests in the gateway or email-ingestion test files.

### Security

- [ ] No plaintext secrets committed to the repository (`.env` files git-ignored, no hardcoded
      tokens in source).
- [ ] `CF_WEBHOOK_SECRET` is at least 32 bytes of random entropy.
- [ ] `GATEWAY_CP_TOKEN` is at least 32 bytes of random entropy.
- [ ] Cross-tenant adversarial tests pass
      (`packages/email-ingestion-gateway/src/__tests__/integration.test.ts` — TENANT_MISMATCH,
      replay, invalid auth test cases).

### Anti-coupling gate

- [ ] No runtime import from `packages/email-ingestion-gateway` into `packages/gmail-listener`.
- [ ] No runtime import from `packages/email-ingestion-gateway` to any file under
      `packages/gmail-listener/src/`.
- [ ] Gateway test helpers do not import from the legacy listener.

---

## Deployment Sequence

### Stage 1 — Server preparation (already complete as of S01–S14)

- [x] `email-ingestion` server module deployed with `requestIngestControl` and `ingestEmail`
      mutations.
- [x] `gmail-listener` compatibility shim in place for legacy listener.
- [x] `gateway_control_plane` auth token support enabled in the server.

### Stage 2 — Gateway deployment (shadow mode)

1. Deploy gateway with:
   ```
   EMAIL_INGESTION_V2_ENABLED=1
   EMAIL_INGESTION_SHADOW_MODE=1
   CF_WEBHOOK_SECRET=<secret>
   GATEWAY_CP_TOKEN=<token>
   GATEWAY_SERVER_URL=<server-url>
   ```
2. Configure Cloudflare Worker to forward to the gateway (see `cloudflare-setup-runbook.md` §1).
3. Run staging smoke tests (see `cloudflare-setup-runbook.md` §6).
4. Monitor shadow logs for 24–48 hours:
   - `shadow:orchestration:complete` with `outcome: INSERTED` for known aliases.
   - `shadow:orchestration:failed` should be zero or match known-bad test cases.
   - No `TENANT_MISMATCH` or `GRANT_INVALID` in logs.

### Stage 3 — Production cutover (live mode)

1. Confirm shadow-mode parity is satisfactory.
2. Disable shadow mode and keep v2 enabled:
   ```
   EMAIL_INGESTION_V2_ENABLED=1
   EMAIL_INGESTION_SHADOW_MODE=0
   ```
3. Monitor for 1 hour:
   - `orchestrate:ingest:complete` with expected outcomes.
   - p99 `/webhook` latency within acceptable range (baseline + 20%).
   - Error rate below 1%.
4. After 24 hours of stable production traffic, the legacy Gmail listener can be scheduled for
   decommission.

### Stage 4 — Legacy listener decommission (after full confidence)

1. Remove Cloudflare Email Routing rule that forwards to the Gmail inbox used by the legacy
   listener.
2. Disable the legacy listener service.
3. Remove the `gmail-listener` compatibility shim from the server after the legacy package is gone.

---

## Rollback Criteria and Procedure

### Trigger any one of these to initiate rollback

| Condition                         | Metric / Log event                                                     |
| --------------------------------- | ---------------------------------------------------------------------- |
| Ingest failure rate > 5%          | `orchestrate:ingest:failed` / `orchestrate:control:denied` over 15 min |
| Tenant mismatch detected          | `reason: TENANT_MISMATCH` in production ingest logs                    |
| Grant replay in production        | `reason: GRANT_INVALID` (outside of expected duplicate deliveries)     |
| Any cross-tenant data access      | Security alert from DB-level RLS audit logs                            |
| Gateway p99 latency > 2× baseline | APM alert                                                              |
| Smoke test regression             | Any staging smoke test fails after a deploy                            |

### Rollback procedure

1. **Immediate stop** — set `EMAIL_INGESTION_V2_ENABLED=0` and redeploy (gateway returns `503`;
   legacy listener continues unaffected).
2. **If in shadow mode** — set `EMAIL_INGESTION_SHADOW_MODE=0` instead (gateway responds but stops
   calling server).
3. **Verify legacy path** — confirm legacy listener is processing new messages.
4. **Capture incident data**:
   - Collect gateway logs with `correlation_id`, `reason_code`, `outcome`.
   - Collect server-side decision_id and audit_id for any affected messages.
5. **No data rollback required** — idempotency keys prevent duplicate inserts if the same message is
   re-delivered after the incident.
6. **Root cause and re-cutover** — diagnose using structured logs, add a regression test, then
   re-run the deployment sequence from Stage 2.

---

## Final Validation Sequence

Run before creating the cutover PR:

```bash
# 1. Regenerate types (must be a no-op if schema hasn't changed)
yarn generate

# 2. Lint — must be zero errors
yarn lint

# 3. Unit tests
yarn test

# 4. Integration tests (requires PostgreSQL + migrations)
yarn test:integration
```

All four steps must succeed with zero errors before production cutover.

---

## Engineering and Ops Sign-off

| Role          | Name | Date | Notes |
| ------------- | ---- | ---- | ----- |
| Lead engineer |      |      |       |
| Reviewer      |      |      |       |
| Ops / SRE     |      |      |       |
