# Open tasks across `docs/`

A single list of every open task, future fix, deferred / "saved for later" item, open question and
known limitation written anywhere under `docs/`, with a reference back to the line it comes from.

> **How this was built:** every markdown file under `docs/` (56 files, ~34k lines) was read in full
> on 2026-11-16. Items are listed **as the docs state them — not verified against the code.** Many
> plan / prompt docs were never updated after implementation, so an unchecked box may already be
> done; each doc's self-reported status is quoted to help judge that. Line numbers refer to the docs
> as of commit `d215099`.

**Legend**

| Tag          | Meaning                                                                        |
| ------------ | ------------------------------------------------------------------------------ |
| `task`       | Unchecked work item, or an implementation step with no completion marker       |
| `checklist`  | Acceptance criteria, test / verification checklist, ops gate or sign-off       |
| `TODO`       | `TODO` / `TBD` marker or an unfilled placeholder                               |
| `future`     | Future work, "future enhancement", phase 2, nice-to-have                       |
| `deferred`   | Explicitly postponed / out of scope for now / temporary code awaiting removal  |
| `follow-up`  | A named follow-up or "next steps" item                                         |
| `limitation` | Known limitation, gap or tech debt the doc says should eventually be addressed |
| `security`   | Open security finding                                                          |
| `question`   | Open question / undecided decision                                             |

Line refs link to the source file (`#L<n>` jumps to the line in VS Code and in GitHub's source
view).

---

## Highlights

The items that read as most actionable or risky:

- **Latent data loss in dynamic reports** — `buildReportTree` drops leaves with no sum, so a Resave
  permanently deletes that entity from the template. Marked "fix this first".
  [dynamic-report-change-tracking/plan.md:38](dynamic-report-change-tracking/plan.md#L38)
- **Email-ingestion v2 security findings still open** — M1 (in-memory replay nonces), M3 (no server
  kill-switch), M4 (no retention for quarantine/grants/nonces), M5, M6, L1–L5, N1–N3, with a
  recommended fix order.
  [multi-tenant-gmail-listener/security-architecture-review.md:268](multi-tenant-gmail-listener/security-architecture-review.md#L268)
- **Email-ingestion cutover not done** — all 13 pre-deployment boxes unchecked; Stages 2–4 (shadow
  mode, production cutover, legacy decommission) and sign-off pending.
  [multi-tenant-gmail-listener/release-checklist.md:81](multi-tenant-gmail-listener/release-checklist.md#L81)
- **Invitations: no email is sent and email/password invitees have no working path** — "to be filed
  as a follow-up issue under #4611".
  [operations/auth0-runbook.md:39](operations/auth0-runbook.md#L39),
  [user-authentication-plan/spec.md:81](user-authentication-plan/spec.md#L81)
- **Auth0 email-relink fallback** lets an unlinked identity take over all `business_users` rows of
  the local user; only procedural mitigation stated.
  [operations/auth0-runbook.md:79](operations/auth0-runbook.md#L79)
- **DB connections held across external I/O** — only document ingestion was converted; "other
  external-I/O paths have not been converted yet".
  [operations/db-connection-pool.md:149](operations/db-connection-pool.md#L149)
- **All-charges performance Steps 3–6 not done** (incl. the OTLP exporter URL bug F8).
  [all-charges-performance-boost/enhancement-plan.md:53](all-charges-performance-boost/enhancement-plan.md#L53)
- **Multi-business request: RLS only tested as superuser**; write-target args not exposed yet.
  [multi-business-request/plan.md:233](multi-business-request/plan.md#L233)
- **Charge filters `unbalanced` / `businessTrip` accepted but ignored** — implement or drop.
  [charges-filters/backend-followup.md:102](charges-filters/backend-followup.md#L102)
- **Provider credentials: env fallback + env vars still to be removed; credential args not yet in
  the log-redaction list.**
  [user-providers-credentials/spec.md:528](user-providers-credentials/spec.md#L528)
- **Mesh v1: SDK codegen move to v6 is the remaining follow-up.**
  [mesh-v1-migration/plan.md:9](mesh-v1-migration/plan.md#L9)
- **Stale plans that look shipped but were never closed out** — the Auth0 migration plan
  (`user-authentication-plan/*`, ~160 unchecked boxes), `claude-code-setup/spec.md`, and the
  archived demo-data docs. Worth a pass to mark done / archive so real open items stand out.

---

## Summary

Item counts are bullets in this file (grouped checkbox runs count as one).

| Area                         | Doc                                                                                                                                                        | Self-reported status                                    |   Items |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------: |
| Auth & users                 | [user-authentication-plan/prompt_plan.md](user-authentication-plan/prompt_plan.md)                                                                         | No progress tracking; feature appears shipped           |      33 |
| Auth & users                 | [user-authentication-plan/blueprint.md](user-authentication-plan/blueprint.md)                                                                             | None; says "fully migrated to Auth0"                    |      24 |
| Auth & users                 | [user-authentication-plan/spec.md](user-authentication-plan/spec.md)                                                                                       | None; 2026-10 notes record gaps                         |      30 |
| Auth & users                 | [user-authentication-plan/auth0-setup.md](user-authentication-plan/auth0-setup.md)                                                                         | None                                                    |       4 |
| Auth & users                 | [user-authentication-plan/migration-test-scenarios.md](user-authentication-plan/migration-test-scenarios.md)                                               | None; 19 boxes unchecked                                |       1 |
| Auth & users                 | [operations/auth0-runbook.md](operations/auth0-runbook.md)                                                                                                 | Runbook                                                 |       5 |
| Auth & users                 | [super-user/super-admin-runbook.md](super-user/super-admin-runbook.md)                                                                                     | Runbook                                                 |       2 |
| Auth & users                 | [user-providers-credentials/spec.md](user-providers-credentials/spec.md)                                                                                   | None                                                    |       8 |
| Auth & users                 | [user-providers-credentials/blueprint.md](user-providers-credentials/blueprint.md)                                                                         | None                                                    |       4 |
| Email ingestion              | [multi-tenant-gmail-listener/architecture-plan.md](multi-tenant-gmail-listener/architecture-plan.md)                                                       | Locked decisions; rollout in progress                   |       5 |
| Email ingestion              | [multi-tenant-gmail-listener/business-recognition-plan.md](multi-tenant-gmail-listener/business-recognition-plan.md)                                       | Implemented A–E; legacy deprecation + 2 follow-ups left |       6 |
| Email ingestion              | [multi-tenant-gmail-listener/cloudflare-setup-runbook.md](multi-tenant-gmail-listener/cloudflare-setup-runbook.md)                                         | Runbook                                                 |       7 |
| Email ingestion              | [multi-tenant-gmail-listener/prompt-plan.md](multi-tenant-gmail-listener/prompt-plan.md)                                                                   | None (S01–S14 done per release checklist)               |       3 |
| Email ingestion              | [multi-tenant-gmail-listener/release-checklist.md](multi-tenant-gmail-listener/release-checklist.md)                                                       | Pre-deploy boxes + Stages 2–4 open                      |       9 |
| Email ingestion              | [multi-tenant-gmail-listener/security-architecture-review.md](multi-tenant-gmail-listener/security-architecture-review.md)                                 | H1–H3, M2 fixed; rest open                              |      17 |
| Multi-business & MCP scoping | [multi-business-request/plan.md](multi-business-request/plan.md)                                                                                           | Steps 1–15 implemented; residual risks                  |       8 |
| Multi-business & MCP scoping | [coherent-owner-scoping-for-mcp/plan.md](coherent-owner-scoping-for-mcp/plan.md)                                                                           | Phase 0 done; Phases 1–7 unmarked                       |      14 |
| Multi-business & MCP scoping | [charges-filters/backend-followup.md](charges-filters/backend-followup.md)                                                                                 | Implemented; "Still open" list                          |       3 |
| Performance & observability  | [all-charges-performance-boost/enhancement-plan.md](all-charges-performance-boost/enhancement-plan.md)                                                     | Steps 1–2 done; 3–6 open                                |       7 |
| Performance & observability  | [all-charges-performance-boost/findings.md](all-charges-performance-boost/findings.md)                                                                     | Results for Steps 1–2 only                              |       3 |
| Performance & observability  | [operations/db-connection-pool.md](operations/db-connection-pool.md)                                                                                       | Runbook                                                 |       1 |
| Performance & observability  | [otel/spec.md](otel/spec.md)                                                                                                                               | None; phases unmarked                                   |       5 |
| Performance & observability  | [otel/prompt_plan.md](otel/prompt_plan.md)                                                                                                                 | None; steps unmarked                                    |       3 |
| Planned features             | [cpi-provider/plan.md](cpi-provider/plan.md)                                                                                                               | None; infra-only first PR decided                       |       8 |
| Planned features             | [dynamic-report-change-tracking/plan.md](dynamic-report-change-tracking/plan.md)                                                                           | None; Steps 0–4 unmarked                                |       9 |
| Planned features             | [matching-screen/prompt_plan.md](matching-screen/prompt_plan.md)                                                                                           | None; nothing marked                                    |       2 |
| Planned features             | [matching-screen/spec.md](matching-screen/spec.md)                                                                                                         | None                                                    |       4 |
| Planned features             | [securities-semi-annual-report/plan.md](securities-semi-annual-report/plan.md)                                                                             | Prereq PRs merged; report unmarked                      |       9 |
| Tooling & infra              | [architecture/scraper-app-refactor/plan.md](architecture/scraper-app-refactor/plan.md)                                                                     | None (package exists)                                   |       7 |
| Tooling & infra              | [architecture/scraper-app-refactor/blueprint.md](architecture/scraper-app-refactor/blueprint.md)                                                           | None; prompts 0–20 unmarked                             |       4 |
| Tooling & infra              | [mesh-v1-migration/plan.md](mesh-v1-migration/plan.md)                                                                                                     | Phases 1–3 done; v6 codegen left                        |       9 |
| Tooling & infra              | [claude-code-setup/spec.md](claude-code-setup/spec.md)                                                                                                     | "Ready for implementation" (looks implemented)          |      11 |
| Archived projects            | [archive/businesses-page-refactor/plan.md](archive/businesses-page-refactor/plan.md)                                                                       | None                                                    |       2 |
| Archived projects            | [archive/businesses-page-refactor/blueprint.md](archive/businesses-page-refactor/blueprint.md)                                                             | None                                                    |       3 |
| Archived projects            | [archive/demo-staging-dataset/demo-staging-dataset-spec.md](archive/demo-staging-dataset/demo-staging-dataset-spec.md)                                     | "Ready for Implementation"                              |      15 |
| Archived projects            | [archive/demo-staging-dataset/demo-staging-dataset-todo.md](archive/demo-staging-dataset/demo-staging-dataset-todo.md)                                     | "In Progress"; phases 1–8 checked                       |       9 |
| Archived projects            | [archive/demo-staging-dataset/demo-staging-dataset-prompt-plan.md](archive/demo-staging-dataset/demo-staging-dataset-prompt-plan.md)                       | "Ready for Sequential Execution"                        |       5 |
| Archived projects            | [archive/demo-staging-dataset/demo-staging-dataset-ledger-validation/spec.md](archive/demo-staging-dataset/demo-staging-dataset-ledger-validation/spec.md) | None                                                    |       4 |
| Archived projects            | [archive/demo-test-data/demo-test-data-plan.md](archive/demo-test-data/demo-test-data-plan.md)                                                             | S1–S5 done; "will evolve"                               |      10 |
| Archived projects            | [archive/demo-test-data/demo-test-data-todo.md](archive/demo-test-data/demo-test-data-todo.md)                                                             | "All TODO items … completed"                            |       6 |
| Archived projects            | [archive/demo-test-data/demo-test-data-prompt-plan.md](archive/demo-test-data/demo-test-data-prompt-plan.md)                                               | Prompts 1–7, 18–23 completed                            |       5 |
| Archived projects            | [archive/demo-test-data/architectural-improvements-s1-s3.md](archive/demo-test-data/architectural-improvements-s1-s3.md)                                   | Critical–Medium done                                    |       2 |
| Archived projects            | [archive/demo-test-data/architectural-improvements-milestone2.md](archive/demo-test-data/architectural-improvements-milestone2.md)                         | "Stable"                                                |       4 |
| Archived projects            | [archive/demo-test-data-infrastructure-consolidation/spec.md](archive/demo-test-data-infrastructure-consolidation/spec.md)                                 | Partial progress (steps 1–3)                            |       7 |
| Archived projects            | [archive/demo-test-data-infrastructure-consolidation/todo.md](archive/demo-test-data-infrastructure-consolidation/todo.md)                                 | 12 checked / 43 open                                    |      16 |
| Archived projects            | [archive/demo-test-data-infrastructure-consolidation/prompt_plan.md](archive/demo-test-data-infrastructure-consolidation/prompt_plan.md)                   | Partial progress                                        |       2 |
| Archived projects            | [archive/dynamic-report-refactor/spec.md](archive/dynamic-report-refactor/spec.md)                                                                         | None                                                    |       2 |
| Archived projects            | [archive/dynamic-report-refactor/blueprint.md](archive/dynamic-report-refactor/blueprint.md)                                                               | Mixed: done / partial / not started                     |       4 |
|                              | **Total**                                                                                                                                                  |                                                         | **361** |

---

## Active docs

### Auth & users

#### [user-authentication-plan/prompt_plan.md](user-authentication-plan/prompt_plan.md)

_Status:_ none stated — a sequential prompt list that does not track progress. The only 5 checked
boxes (L5053-5057) sit inside a _template_ for a future `migration-summary.md`; the "Phase N
Complete" ✅ sections describe target states, not progress.

- [L105](user-authentication-plan/prompt_plan.md#L105), L112 — `future` — `permissions` /
  `role_permissions` tables are "for future use, not initially enforced" (Prompt 1.2).
- [L311-313](user-authentication-plan/prompt_plan.md#L311), L350 — `future` — permission override
  tables are "initially unpopulated but ready for future granular permissions feature" (Prompt 1.5).
- [L774-775](user-authentication-plan/prompt_plan.md#L774) — `deferred` — `authType === 'apiKey'`
  returns null "for now (placeholder, implement in Phase 7)"; picked up by Prompt 8.2 (L6102-6105).
- [L981-989](user-authentication-plan/prompt_plan.md#L981), L1068-1083 — `deferred` —
  `TenantAwareDBClient` has a TEMPORARY `@Inject(CONTEXT)` fallback to `context.currentUser.userId`;
  removal deferred to Phase 4.8.
- [L1086-1093](user-authentication-plan/prompt_plan.md#L1086) — `follow-up` — Prompt 2.6 "NEXT
  STEPS": Prompts 2.7, 2.8, Phase 3 RLS, Phase 4 Auth0 activation, Prompt 4.7 provider migration.
- [L1267-1273](user-authentication-plan/prompt_plan.md#L1267) — `deferred` — three ⏳ benefits
  pending "Phase 4.8": DI with `AUTH_CONTEXT`, direct provider injection for admin context,
  automatic `TenantAwareDBClient` (RLS enforced).
- [L1517-1543](user-authentication-plan/prompt_plan.md#L1517), L1618-1619, L1632, L1753-1755 —
  `deferred` — `rlsContextPlugin` / `context.rlsClient` are "TEMPORARY (Phase 2.9 → 4.8)" and
  "@deprecated Will be removed in Phase 4.8".
- [L1564-1565](user-authentication-plan/prompt_plan.md#L1564) — `future` — `app.current_user_id`
  "not needed yet … can be added in future if needed".
- [L1785-1791](user-authentication-plan/prompt_plan.md#L1785) — `task` — Prompt 2.9 "Removal
  Checklist (Phase 4.8)" (5 boxes): remove `rlsContextPlugin()` from `index.ts`; remove `rlsClient`
  from `AccounterContext`; delete `rls-context-plugin.ts`; verify no `context.rlsClient` references;
  verify `rg "rlsClient|rls-context-plugin"` is empty.
- [L1962](user-authentication-plan/prompt_plan.md#L1962) — `future` — `owner_id` "will be replaced
  with business_id in later migration".
- [L2679](user-authentication-plan/prompt_plan.md#L2679) — `future` — "Add Permissions in the Access
  Token: Yes (for future permission claims)".
- [L3145-3172](user-authentication-plan/prompt_plan.md#L3145) — `checklist` — Prompt 4.5's embedded
  `migration-test-scenarios.md` template (19 boxes: Login Flow 4, Authorization 4, Multi-Tenant
  Isolation 3, Edge Cases 4, Rollback Test 4). Same content as
  [migration-test-scenarios.md](#user-authentication-planmigration-test-scenariosmd).
- [L3240-3244](user-authentication-plan/prompt_plan.md#L3240) — `task` — Prompt 4.6 prerequisites
  (5): Auth0 tenant configured; app settings obtained; callback URLs configured; backend
  verification ready; migration test users created.
- [L3595-3602](user-authentication-plan/prompt_plan.md#L3595) — `checklist` — Prompt 4.6 staging
  validation (8): Auth0 button; redirect to Universal Login; `/auth/callback`; redirect to
  `/charges`; token in `Authorization` header; legacy login still works; toggle between logins; no
  console errors.
- [L3640-3645](user-authentication-plan/prompt_plan.md#L3640) — `checklist` — gate before Prompt
  4.7: frontend in production, QA validated, 24h monitoring passed, team confirms.
- [L3674-3684](user-authentication-plan/prompt_plan.md#L3674) — `task` — Prompt 4.7 prerequisites
  (11): tenant fully configured; V2 plugin/provider tested; parallel testing; test users validated
  in staging; frontend deployed to prod; frontend validated; staging e2e; rollback procedure tested
  and documented; team trained on rollback; monitoring dashboards; support on standby.
- [L3749-3755](user-authentication-plan/prompt_plan.md#L3749) — `checklist` — Prompt 4.7 staging
  soak (7): Auth0 login e2e; test users log in; backend accepts tokens; GraphQL queries succeed; RLS
  enforced; no auth errors; latency increase < 10%.
- [L3768-3772](user-authentication-plan/prompt_plan.md#L3768) — `checklist` — post-deployment
  monitoring (5): auth success > 99%; no rise in 401/403; JWT errors < 0.1%; DB performance stable;
  no RLS violations.
- [L3793](user-authentication-plan/prompt_plan.md#L3793) — `question` — rollback says "If USE_AUTH0
  flag implemented, toggle to false" — unclear whether the flag exists.
- [L3826](user-authentication-plan/prompt_plan.md#L3826) — `deferred` — "Old auth code disabled but
  not deleted (kept for 7 days)" until Phase 5.
- [L4226-4231](user-authentication-plan/prompt_plan.md#L4226) — `follow-up` — Prompt 4.8 next steps:
  migrate remaining providers incrementally; "eventually deprecate direct DBProvider usage in
  providers (Phase 5)"; ESLint rule enforcing `TenantAwareDBClient`. Repeated at
  [L4449-4453](user-authentication-plan/prompt_plan.md#L4449) (Prompt 4.9).
- [L4629-4635](user-authentication-plan/prompt_plan.md#L4629) — `checklist` — gate for Prompt 5.1:
  7+ days since cutover, zero auth incidents, no rollbacks, team confidence, 100% Auth0 JWT usage.
- [L4731-4748](user-authentication-plan/prompt_plan.md#L4731) — `follow-up` — audit
  `legacy_business_users`; drop if unused, otherwise "document dependencies and create follow-up
  task".
- [L4750-4754](user-authentication-plan/prompt_plan.md#L4750) — `follow-up` — remove
  migration-specific docs, update README, "archive migration plan to
  `docs/archive/user-authentication-plan/`" (not done — see
  [inconsistencies](#doc-inconsistencies-spotted)).
- [L4766-4769](user-authentication-plan/prompt_plan.md#L4766) — `future` — optional, low-priority DB
  cleanup: archive audit logs from test users, remove migration test data.
- [L5035-5043](user-authentication-plan/prompt_plan.md#L5035) — `follow-up` — Prompt 5.3: archive
  the migration docs, keep only `auth0-setup.md` and a new `migration-summary.md`.
- [L5048-5070](user-authentication-plan/prompt_plan.md#L5048) — `TODO` — `migration-summary.md`
  template placeholders unfilled (cutover date, total time, downtime, users migrated, success rate,
  incidents/rollbacks, lessons learned).
- [L5098-5099](user-authentication-plan/prompt_plan.md#L5098) — `checklist` — Phase 6 only after
  Phases 1-5 are stable in production for 7+ days.
- [L5110-5112](user-authentication-plan/prompt_plan.md#L5110) — `future` — permissions tables
  "remain unpopulated and unused for now. Granular permission-based authorization is a future
  enhancement."
- [L6406](user-authentication-plan/prompt_plan.md#L6406) — `follow-up` — AuthCallbackPage
  `appState.returnTo` "likely already done in Phase 4.6 — verify".
- [L7099-7104](user-authentication-plan/prompt_plan.md#L7099) — `deferred` — "For production with
  multiple server instances, switch to Redis-backed limiter" (opt-in via `REDIS_URL`).
- [L7133](user-authentication-plan/prompt_plan.md#L7133), L7181-7182, L7195 — `future` — optional
  minimal audit-log UI page (`audit-logs-page.tsx`).
- [L7216-7259](user-authentication-plan/prompt_plan.md#L7216) — `checklist` — Prompt 10.5 security
  checklist (25 boxes): Auth0 config (RS256, 15-min access token, refresh rotation, 7-day absolute
  expiry, HTTPS-only callbacks, MFA available, attack protection); API & transport (HTTPS/HSTS, CORS
  allowlist, `nosniff`, `X-Frame-Options: DENY`, CSP); DB & RLS (RLS on all tenant tables, zero
  `DBProvider` imports in providers, SHA-256 `key_hash`, 64-char invitation tokens); GraphQL
  (`@requiresAuth` on every mutation, depth limiting, introspection off in prod, non-leaky errors);
  application (parameterized SQL, Management API creds in env, no secrets in git history,
  `yarn audit` clean, invitation cleanup job scheduled). Record findings in
  `docs/operations/security-audit.md` and fix each failed item.

#### [user-authentication-plan/blueprint.md](user-authentication-plan/blueprint.md)

_Status:_ none stated; all 42 boxes unchecked. L2014 says "Production Status: System fully migrated
to Auth0, monitoring for 7 days before cleanup".

- [L63-66](user-authentication-plan/blueprint.md#L63) — `future` — permissions / `role_permissions`
  seeded "for future use, not initially enforced".
- [L145-167](user-authentication-plan/blueprint.md#L145) — `future` — Step 1.5 permission override
  tables stay unpopulated ("not in scope for current phase").
- [L439-451](user-authentication-plan/blueprint.md#L439) — `deferred` — Step 2.6 TEMPORARY fallback
  to `context.currentUser?.userId` (Phase 3.2 → 4.8).
- [L524-533](user-authentication-plan/blueprint.md#L524), L584-585 — `deferred` —
  `AdminContextProvider` still uses `DBProvider`; "Phase 4.9 (later)" switches it to
  `TenantAwareDBClient` with `AuthContextProvider`.
- [L604-610](user-authentication-plan/blueprint.md#L604) — `deferred` — three ⏳ benefits pending
  "Phase 4.9".
- [L855-858](user-authentication-plan/blueprint.md#L855) — `question` — Step 3.4 backfill rules
  incomplete: `business_trips.owner_id` left blank; `financial_accounts` "rename `owner` to
  `owner_id` OR `owner_id = owner`" undecided.
- [L1082-1083](user-authentication-plan/blueprint.md#L1082) — `deferred` — legacy
  `JWT_ACCESS_SECRET` kept "for backward compatibility during migration".
- [L1524-1531](user-authentication-plan/blueprint.md#L1524) — `checklist` — Step 4.6 testing
  checklist (8; same items as prompt_plan L3595).
- [L1547-1554](user-authentication-plan/blueprint.md#L1547) — `task` — Step 4.7 critical
  prerequisites (8): tenant configured; Management API working; parallel testing; test users
  migrated; frontend deployed & tested; Phase 1-3 tests passing; staging with Auth0; rollback plan
  tested.
- [L1605](user-authentication-plan/blueprint.md#L1605) — `follow-up` — make Auth0 the default login,
  remove the legacy option.
- [L1692-1713](user-authentication-plan/blueprint.md#L1692) — `deferred` — Step 4.8 part 3: remove
  the TEMPORARY fallback (`@Inject(CONTEXT)`, the 3 fallback checks, the businessId fallback, the
  `CorporateTaxesProvider` getter fallback).
- [L2014-2016](user-authentication-plan/blueprint.md#L2014) — `deferred` — "monitoring for 7 days
  before cleanup"; next phase is cleanup.
- [L2028-2031](user-authentication-plan/blueprint.md#L2028) — `task` — Step 5.1 prerequisites (4):
  stable 7+ days; no auth incidents; all users migrated or invited; 100% Auth0 JWT usage.
- [L2041-2046](user-authentication-plan/blueprint.md#L2041) — `question` — rename v2 files "(if
  applicable)"; remove `USE_AUTH0` "(if still present)".
- [L2057-2062](user-authentication-plan/blueprint.md#L2057) — `follow-up` — audit
  `legacy_business_users`; drop if unused or document dependencies.
- [L2079-2082](user-authentication-plan/blueprint.md#L2079), L2278 — `future` — permission-based
  authorization / `PermissionResolutionProvider` are a future enhancement.
- [L2282](user-authentication-plan/blueprint.md#L2282) — `follow-up` — "Break into sub-steps per
  module in detailed implementation."
- [L2940-2980](user-authentication-plan/blueprint.md#L2940) — `follow-up` — Step 10.1: remove the
  remaining direct `DBProvider` usages (salaries, financial-entities, documents, ledger-records,
  employees, "all remaining providers"); audit `Scope.Singleton` providers that cache tenant data.
- [L3033](user-authentication-plan/blueprint.md#L3033) — `deferred` — Redis for distributed rate
  limiting "if multi-instance deployment".
- [L3057](user-authentication-plan/blueprint.md#L3057) — `question` — failed auth attempts "from
  Auth0 logs if available".
- [L3076](user-authentication-plan/blueprint.md#L3076) — `future` — optional admin dashboard page of
  recent logs.
- [L3097-3122](user-authentication-plan/blueprint.md#L3097) — `checklist` — Step 10.5 security
  hardening (22 boxes): Auth0 tenant (RS256, 15-min token, rotation, 7-day expiry, callback
  whitelist, MFA available) + API-key SHA-256, JWKS verification, CORS, rate limiting, RLS on all
  tenant tables, ESLint rule, role checks on all mutations, audit logs, non-leaky errors, SQL
  injection, XSS/CSP, dependency audit, Management API creds in env, cleanup job, HTTPS. L3122
  requires "Security checklist 100% complete".
- [L3227-3231](user-authentication-plan/blueprint.md#L3227) — `question` — trade-offs: Auth0 cost vs
  dev time, external dependency, limited customization.
- [L3235-3244](user-authentication-plan/blueprint.md#L3235) — `follow-up` — next steps: turn the
  blueprint into issues, prompts, test plan, deployment plan; complete tenant setup; write docs.

#### [user-authentication-plan/spec.md](user-authentication-plan/spec.md)

_Status:_ no overall status; dated "Note (2026-10)" entries record current behaviour and gaps. 16
boxes, none checked.

- [L28](user-authentication-plan/spec.md#L28), L118-129 — `future` — MFA and social logins are
  future enhancements (tenant configuration only).
- [L81-86](user-authentication-plan/spec.md#L81) — `limitation` — invitation flow steps 2-3 not
  implemented: no password-setup email (`sendPasswordResetEmail` has no callers); invitees must sign
  in with Google; "email/password invitees are an open gap (to be filed as a follow-up under
  #4611)".
- [L91-92](user-authentication-plan/spec.md#L91) — `deferred` — email changes via Auth0 profile "out
  of scope for initial implementation".
- [L94-95](user-authentication-plan/spec.md#L94) — `limitation` — "The password setup flow is not
  implemented."
- [L107-111](user-authentication-plan/spec.md#L107), L135-155 — `future` — granular permissions;
  migration path: implement `PermissionResolutionProvider`, admin UI for grants/revokes, check
  `authContext.permissions` instead of role.
- [L123-126](user-authentication-plan/spec.md#L123) — `limitation` — one Auth0 `sub` per local user;
  a second sign-in method creates a separate Auth0 user unless linked via Auth0 account linking.
- [L130-131](user-authentication-plan/spec.md#L130), L1762, L1778 — `future` — Auth0 email template
  customization / branding.
- [L132-134](user-authentication-plan/spec.md#L132) — `future` — "Full multi-business UI switching
  is a future enhancement" (L1549-1555 still describes a business selector).
- [L185-213](user-authentication-plan/spec.md#L185), L1666-1667 — `future` — `permissions`,
  `role_permissions`, `user_permission_overrides`, `api_key_permission_overrides` are "(Future)" and
  unpopulated; `AuthUser.permissions` depends on the future resolver.
- [L264-270](user-authentication-plan/spec.md#L264) — `deferred` — "RLS Context Bridge"
  (`rlsContextPlugin`) is temporary, removed in Phase 4.8.
- [L290-311](user-authentication-plan/spec.md#L290) — `deferred` — Phase 4.8 cleanup checklist:
  remove `@Inject(CONTEXT)` and `context.currentUser.userId` fallbacks;
  `corporate-taxes.provider.ts` businessId getter should return only `authContext.tenant.businessId`
  and throw if null.
- [L413](user-authentication-plan/spec.md#L413) — `future` — "Read Replicas (Future)".
- [L457-464](user-authentication-plan/spec.md#L457) — `limitation` — architectural debt: single
  refresh-token storage → multi-session; explicit `active_business_id` per session; avoid embedding
  immutable permissions without rotation safeguards.
- [L468-469](user-authentication-plan/spec.md#L468) — `limitation` — "Current Risk": Singleton
  providers with shared caches (e.g. `BusinessesProvider`) leak data across tenants.
- [L518-526](user-authentication-plan/spec.md#L518) — `task` — "Migration Checklist for All
  Providers" (5): audit Singleton providers; identify tenant-data caches; convert to Operation scope
  or tenant-prefix; list providers allowed to stay Singleton; add cache-isolation integration tests.
- [L528-540](user-authentication-plan/spec.md#L528) — `question` — "Known Providers Requiring
  Audit": `businesses.provider.ts`, `financial-entities.provider.ts` ("check if Singleton with
  cache"), `admin-context.provider.ts`, `admin-context-plugin.ts`, any DataLoader provider.
- [L604](user-authentication-plan/spec.md#L604) — `question` — `dynamic_report_templates` `owner_id`
  "needs verification".
- [L643-654](user-authentication-plan/spec.md#L643) — `question` — backfill rules undecided / "needs
  analysis": employees (employer field?), `financial_accounts` (rename vs add), pension_funds,
  sort_codes, tags ("may be global or per-business").
- [L700-706](user-authentication-plan/spec.md#L700) — `future` — optional: migrate legacy business
  owners into `business_users` without Auth0 accounts.
- [L752-754](user-authentication-plan/spec.md#L752) — `deferred` — `adminContextPlugin` is a
  transitional legacy pattern, not to be used after `AdminContextProvider` activation.
- [L925-926](user-authentication-plan/spec.md#L925), L944-947, L961, L981-982, L1034-1041, L1057,
  L1064-1065 — `future` — permission resolution / permission-based validation are future work;
  override tables populated later by an admin UI.
- [L1229-1230](user-authentication-plan/spec.md#L1229), L1312-1320, L1350-1357 — `deferred` —
  `AdminContextProvider` not registered until Phase 4.9; 7 activation steps; 4 ⏳ benefits pending.
- [L1381](user-authentication-plan/spec.md#L1381), L1482 — `deferred` — `USE_AUTH0` flag added
  (default false); Phase 5 removes it.
- [L1415-1417](user-authentication-plan/spec.md#L1415) — `task` — Step 4.6 prerequisites (3): tenant
  configured; Management API working; parallel backend testing.
- [L1432-1439](user-authentication-plan/spec.md#L1432) — `task` — Step 4.7 prerequisites (8; same as
  blueprint L1547).
- [L1450](user-authentication-plan/spec.md#L1450) — `follow-up` — make Auth0 login the default,
  remove legacy login.
- [L1474-1486](user-authentication-plan/spec.md#L1474) — `deferred` — Phase 5 cleanup "after 7 days
  of stability": delete old auth files, rename v2 files, remove `USE_AUTH0`, update docs, remove old
  auth tests.
- [L1627-1628](user-authentication-plan/spec.md#L1627) — `deferred` — permission-based authorization
  tests out of scope.
- [L1653-1654](user-authentication-plan/spec.md#L1653) — `limitation` — rows that can't be
  deterministically assigned stay inaccessible under RLS "until resolved" (quarantine).
- [L1836-1838](user-authentication-plan/spec.md#L1836) — `future` — consider Auth0's mock library
  for Node tests.

#### [user-authentication-plan/auth0-setup.md](user-authentication-plan/auth0-setup.md)

_Status:_ none stated; one dated note (2026-10).

- [L57-60](user-authentication-plan/auth0-setup.md#L57) — `question` — if `@auth0/auth0-react` runs
  as a browser-only SPA, check the app type / grants support SPA + PKCE (the guide says to create a
  "Regular Web Application", L29).
- [L172-179](user-authentication-plan/auth0-setup.md#L172) — `limitation` — invitation acceptance
  does _not_ trigger a password-setup flow; invitees sign in with Google; "email/password invitees
  are an open gap".
- [L185-197](user-authentication-plan/auth0-setup.md#L185) — `checklist` — Section 7 setup checklist
  (12): tenant; app URLs; URLs match frontend; refresh token rotation with expirations; grant types;
  API RS256 + identifier; Allow Offline Access; M2M app scopes; `Username-Password-Authentication`
  enabled; server `AUTH0_*` env; client `VITE_AUTH0_*` env; `business_users.auth0_user_id` mapping.
- [L243-253](user-authentication-plan/auth0-setup.md#L243) — `TODO` — "Runtime Configuration Record"
  is blank for every environment (tenant domain, audience, client IDs, frontend URL, last verified,
  verified by).

#### [user-authentication-plan/migration-test-scenarios.md](user-authentication-plan/migration-test-scenarios.md)

_Status:_ none stated; 19 boxes, none checked. Identical to the template in prompt_plan L3130-3173.

- [L14-42](user-authentication-plan/migration-test-scenarios.md#L14) — `checklist` — Login Flow (4:
  Universal Login, JWT issued/verified, auth context populated, business/role mapped); Authorization
  (4: owner full access, accountant can't manage users, employee can't see salaries, API key auth);
  Multi-Tenant Isolation (3: A can't reach B, RLS enforced, cross-business blocked); Edge Cases (4:
  expired JWT, bad signature, unknown user → null context, concurrent isolation); Rollback Test (4:
  `USE_AUTH0=false`, restart, old auth works, < 1 min downtime).

#### [operations/auth0-runbook.md](operations/auth0-runbook.md)

_Status:_ runbook, none stated.

- [L24-26](operations/auth0-runbook.md#L24), L44-47 — `limitation` — no invitation email is sent;
  the web client's `createInvitation` doesn't request `token` yet shows "Invitation sent
  successfully"; workaround is calling the GraphQL API directly.
- [L33-35](operations/auth0-runbook.md#L33) — `limitation` — Google-invitee acceptance is "per code,
  not yet verified end to end".
- [L39-43](operations/auth0-runbook.md#L39) — `follow-up` — email/password invitees have no working
  path (blocked placeholder, discarded password, `sendPasswordResetEmail` unused): "Open gap, to be
  filed as a follow-up issue under #4611."
- [L79-84](operations/auth0-runbook.md#L79), L174-178 — `limitation` (security) — the email relink
  fallback lets an unlinked identity take over all `business_users` rows of the local user; only
  procedural mitigation.
- [L211-215](operations/auth0-runbook.md#L211) — `checklist` — optional Universal Login hint for
  social users: "record it here if it is configured" — not recorded.

#### [super-user/super-admin-runbook.md](super-user/super-admin-runbook.md)

_Status:_ none stated.

- [L36](super-user/super-admin-runbook.md#L36) — `limitation` — "There is currently no revocation
  via the app or the seed script" (DBA SQL only).
- [L106-109](super-user/super-admin-runbook.md#L106) — `future` — cross-tenant access roadmap Phases
  A–D (global client listing, tenant-switch flow, audit logging). The linked `./plan.md` does not
  exist.

#### [user-providers-credentials/spec.md](user-providers-credentials/spec.md)

_Status:_ none stated; implementation-order steps unmarked.

- [L528-537](user-providers-credentials/spec.md#L528), L862-864 — `follow-up` — env cleanup: remove
  `GreenInvoiceModel` / `DeelModel` env fields and `GREEN_INVOICE_ID`, `GREEN_INVOICE_SECRET`,
  `DEEL_TOKEN` (breaking — "coordinate with a migration runbook").
- [L539-554](user-providers-credentials/spec.md#L539) — `follow-up` — "Remove this fallback once all
  tenants have migrated" (DB-then-env fallback).
- [L577-581](user-providers-credentials/spec.md#L577) — `checklist` — add
  `CREDENTIALS_ENCRYPTION_KEY` to `.env.template`, docker compose dev env and CI / deployment
  config.
- [L594](user-providers-credentials/spec.md#L594) — `follow-up` — add `id`, `secret`, `apiToken` to
  the logging redaction list.
- [L595](user-providers-credentials/spec.md#L595), L870-871 — `follow-up` — key rotation is manual;
  write a one-off re-encryption script.
- [L847-864](user-providers-credentials/spec.md#L847) — `task` — Implementation Order steps 1–12
  (incl. step 11, E2E manual smoke test).
- [L872-873](user-providers-credentials/spec.md#L872) — `question` — audit log of credential writes:
  recommended, "out of scope for initial implementation".
- [L874-876](user-providers-credentials/spec.md#L874) — `question` — should `accountant` see
  connection status read-only? "needs product decision".

#### [user-providers-credentials/blueprint.md](user-providers-credentials/blueprint.md)

_Status:_ none stated; Steps 1–9 unmarked.

- [L25-26](user-providers-credentials/blueprint.md#L25), L400-402 — `deferred` — env cleanup is in
  Chunks F/G but Step 7 makes the env fallback "REQUIRED"; env removal is in none of Steps 1–9.
- [L38-48](user-providers-credentials/blueprint.md#L38), L56-606 — `task` — Steps 1–9: migration,
  env key, encryption/payload helpers, provider, integration tests, GraphQL module, Green Invoice +
  Deel wiring, client hooks, client UI.
- [L369-370](user-providers-credentials/blueprint.md#L369) — `question` — "do NOT re-throw
  GraphQLErrors — wrap them in the union type" contradicts spec §5.5 (spec L408), which re-throws.
- [L617-620](user-providers-credentials/blueprint.md#L617) — `TODO` — add a `TODO` comment at the
  mutation entry points of `provider-credentials.resolvers.ts`; add `id`, `secret`, `apiToken` to
  the redaction list before any logging middleware.

### Email ingestion (multi-tenant gmail listener → `email-ingestion-gateway`)

#### [multi-tenant-gmail-listener/architecture-plan.md](multi-tenant-gmail-listener/architecture-plan.md)

_Status:_ none stated (locked decisions); rollout in progress per sibling docs.

- [L18](multi-tenant-gmail-listener/architecture-plan.md#L18), L170, L177 — `deferred` — legacy
  listener stays active until the new service is implemented, deployed and tested.
- [L31](multi-tenant-gmail-listener/architecture-plan.md#L31), L228-229 — `follow-up` — the
  temporary server compatibility bridge (`modules/gmail-listener/`) is "removed after cutover".
- [L172](multi-tenant-gmail-listener/architecture-plan.md#L172), L176, L194 — `follow-up` —
  shadow-mode validation and dual-run comparison, then tenant-by-tenant cutover.
- [L136](multi-tenant-gmail-listener/architecture-plan.md#L136) — `limitation` — 30-day quarantine
  retention is not enforced (see security review M4).
- [L231-238](multi-tenant-gmail-listener/architecture-plan.md#L231) — `checklist` — success
  criteria, incl. #6 "Shadow mode demonstrates parity before tenant cutover".

#### [multi-tenant-gmail-listener/business-recognition-plan.md](multi-tenant-gmail-listener/business-recognition-plan.md)

_Status:_ "Implemented across Workstreams A–E … The only remaining item is deprecating the legacy
path" (L3-5) — understated: the follow-up checklist has 2 more open items. 22 checked, 3 unchecked.

- [L185-188](multi-tenant-gmail-listener/business-recognition-plan.md#L185) — `question` — 5-min
  grant TTL vs treatment time: "must comfortably cover that, or recognition should be split from
  grant issuance. (Risk.)"
- [L189-192](multi-tenant-gmail-listener/business-recognition-plan.md#L189) — `question` —
  derived-document dedup: body-PDF / link-fetched bytes may not be byte-stable; define a
  deterministic hash or dedup on source.
- [L196](multi-tenant-gmail-listener/business-recognition-plan.md#L196) — `follow-up` — "Keep shadow
  mode until parity holds."
- [L253](multi-tenant-gmail-listener/business-recognition-plan.md#L253) — `task` — deprecate legacy
  `businessEmailConfig` / `insertEmailDocuments` after cutover.
- [L329-330](multi-tenant-gmail-listener/business-recognition-plan.md#L329) (context L310-312) —
  `task` — populate per-tenant `emailIngestion.ownDomains`, verify against production mail, then
  drop `ap@the-guild.dev` from `GLOBAL_INVOICE_PLATFORM_SENDERS`.
- [L331-333](multi-tenant-gmail-listener/business-recognition-plan.md#L331) — `task` — fetch
  link-only documents for unrecognized senders (link config is only returned once a business is
  recognized).

#### [multi-tenant-gmail-listener/cloudflare-setup-runbook.md](multi-tenant-gmail-listener/cloudflare-setup-runbook.md)

_Status:_ operational runbook, none stated.

- [L76-120](multi-tenant-gmail-listener/cloudflare-setup-runbook.md#L76) — `checklist` — "First
  repo-owned deploy" (the Worker predates wrangler; "the repo has never owned it"); 5-step
  procedure, no completion recorded.
- [L97-99](multi-tenant-gmail-listener/cloudflare-setup-runbook.md#L97) — `follow-up` — convert the
  remaining vars to secrets "so `keep_vars` can eventually go away".
- [L133-139](multi-tenant-gmail-listener/cloudflare-setup-runbook.md#L133) — `future` — automate the
  Worker deploy (must wait on Render reporting healthy); "until that exists, deploy the Worker by
  hand".
- [L176-191](multi-tenant-gmail-listener/cloudflare-setup-runbook.md#L176) — `checklist` — v2 starts
  disabled in staging and production; flip only after smoke tests and shadow validation.
- [L276-277](multi-tenant-gmail-listener/cloudflare-setup-runbook.md#L276) — `future` — optional
  mTLS: "Update the Worker to attach the client certificate" (implementation status not stated).
- [L376-377](multi-tenant-gmail-listener/cloudflare-setup-runbook.md#L376) — `limitation` — Test 3
  replay helper always mints a fresh nonce; modify it to reuse a fixed nonce to reproduce.
- [L396-399](multi-tenant-gmail-listener/cloudflare-setup-runbook.md#L396) — `checklist` — all 5
  staging smoke tests pass (correlation IDs logged) before enabling `V2_ENABLED` in production.

#### [multi-tenant-gmail-listener/prompt-plan.md](multi-tenant-gmail-listener/prompt-plan.md)

_Status:_ none stated; release-checklist says S01–S14 complete.

- [L7](multi-tenant-gmail-listener/prompt-plan.md#L7), L17, L39 — `deferred` — legacy
  `gmail-listener` stays operational and "can be retired later" / "until cutover decision".
- [L63](multi-tenant-gmail-listener/prompt-plan.md#L63) — `follow-up` — shadow mode, parity checks,
  tenant-by-tenant cutover.
- [L499](multi-tenant-gmail-listener/prompt-plan.md#L499), L665 — `follow-up` — keep (or fence off)
  the `insertEmailDocuments` compatibility adapter until legacy retirement.

#### [multi-tenant-gmail-listener/release-checklist.md](multi-tenant-gmail-listener/release-checklist.md)

_Status:_ wiring audit marked passing; Stage 1 has 3 boxes checked; 13 pre-deployment boxes
unchecked; Stages 2–4 unmarked; sign-off table blank.

- [L81-87](multi-tenant-gmail-listener/release-checklist.md#L81) — `checklist` — code & type safety
  (3): `yarn generate` with no diff; `yarn lint` clean for gateway + email-ingestion; server and
  gateway typecheck.
- [L89-94](multi-tenant-gmail-listener/release-checklist.md#L89) — `checklist` — tests (3):
  `yarn test` (198 gateway tests); `yarn test:integration`; no skipped / `.only` tests.
- [L96-104](multi-tenant-gmail-listener/release-checklist.md#L96) — `checklist` — security (4): no
  plaintext secrets; `CF_WEBHOOK_SECRET` ≥ 32 bytes; `GATEWAY_CP_TOKEN` ≥ 32 bytes; cross-tenant
  adversarial tests pass.
- [L106-111](multi-tenant-gmail-listener/release-checklist.md#L106) — `checklist` — anti-coupling
  (3): no gateway ↔ gmail-listener runtime imports, incl. test helpers.
- [L124-139](multi-tenant-gmail-listener/release-checklist.md#L124) — `checklist` — Stage 2: gateway
  deploy in shadow mode, Worker config, smoke tests, 24–48h shadow monitoring.
- [L141-154](multi-tenant-gmail-listener/release-checklist.md#L141) — `checklist` — Stage 3:
  production cutover (shadow off), 1h monitoring; after 24h stable, schedule legacy decommission.
- [L156-161](multi-tenant-gmail-listener/release-checklist.md#L156) — `checklist` — Stage 4: remove
  routing rule to the Gmail inbox, disable the legacy service, remove the `gmail-listener` shim.
- [L195-213](multi-tenant-gmail-listener/release-checklist.md#L195) — `checklist` — final validation
  sequence before the cutover PR.
- [L217-223](multi-tenant-gmail-listener/release-checklist.md#L217) — `checklist` — engineering /
  ops sign-off table (lead engineer, reviewer, ops/SRE) is empty.

#### [multi-tenant-gmail-listener/security-architecture-review.md](multi-tenant-gmail-listener/security-architecture-review.md)

_Status:_ "Living document. H1–H3 and M2 have been fixed … Remaining work is medium/low hardening"
(L5-8); "Remaining findings are open" (L277-279).

- [L72-74](multi-tenant-gmail-listener/security-architecture-review.md#L72) — `security` — H2
  caveat: RLS enforcement depends on the production DB role not having `BYPASSRLS`; the S20 audit
  doc needs reconciling.
- [L91-99](multi-tenant-gmail-listener/security-architecture-review.md#L91) — `security` — **M1**
  in-memory nonce store only; `email_ingestion_replay_nonces` unused. Persist, or document and pin
  to one instance.
- [L113-121](multi-tenant-gmail-listener/security-architecture-review.md#L113) — `security` — **M3**
  `EMAIL_INGESTION_V2_ENABLED` / `SHADOW_MODE` parsed but never read → no server kill-switch.
- [L123-130](multi-tenant-gmail-listener/security-architecture-review.md#L123) — `security` — **M4**
  no retention / cleanup for quarantine, grants, idempotency_keys, dedup_fingerprints,
  replay_nonces; add a cron job.
- [L132-139](multi-tenant-gmail-listener/security-architecture-review.md#L132) — `security` — **M5**
  every control error maps to `UNKNOWN_ALIAS`; propagate a distinct `reasonCode`.
- [L141-151](multi-tenant-gmail-listener/security-architecture-review.md#L141) — `security` — **M6**
  alias/nonce RLS policies easy to misread; nullable `replay_nonces.owner_id` conflicts with
  `FOR ALL … WITH CHECK`; split the policies.
- [L155-161](multi-tenant-gmail-listener/security-architecture-review.md#L155) — `security` — **L1**
  empty `CF_WEBHOOK_SECRET` outside production means no auth; fail fast whenever v2 is enabled.
- [L163-166](multi-tenant-gmail-listener/security-architecture-review.md#L163) — `security` — **L2**
  IP allowlist is IPv4-only (IPv6 silently rejected); document it.
- [L168-172](multi-tenant-gmail-listener/security-architecture-review.md#L168) — `security` — **L3**
  `/readiness` always `{ready:true}` (no server-connectivity check).
- [L174-177](multi-tenant-gmail-listener/security-architecture-review.md#L174) — `security` — **L4**
  server ↔ gateway contracts parity enforced only by tests.
- [L179-182](multi-tenant-gmail-listener/security-architecture-review.md#L179) — `security` — **L5**
  gateway logger has no redaction layer; consider an allowlist.
- [L184-191](multi-tenant-gmail-listener/security-architecture-review.md#L184) — `security` — **N1**
  MIME parser is a live attack surface; add fuzz tests.
- [L193-198](multi-tenant-gmail-listener/security-architecture-review.md#L193) — `security` — **N2**
  Worker health-probe TOCTOU: message lost if the gateway dies between probe and POST.
- [L200-204](multi-tenant-gmail-listener/security-architecture-review.md#L200) — `security` — **N3**
  body cap widened 1 MiB → 25 MB (intentional; larger memory envelope).
- [L235-243](multi-tenant-gmail-listener/security-architecture-review.md#L235) — `follow-up` — test
  gaps: rawMessageHash mismatch control vs ingest; nonce replay across restart/instances; inactive
  alias e2e; IPv6 source vs allowlist; empty secret outside prod; adversarial MIME.
- [L252](multi-tenant-gmail-listener/security-architecture-review.md#L252), L255, L260 — `security`
  — plan-alignment warnings: IPv4-only allowlist, no quarantine retention job, in-memory replay
  nonces.
- [L268-275](multi-tenant-gmail-listener/security-architecture-review.md#L268) — `follow-up` —
  recommended fix order: M1/M3/M4 → M5/M6 → N1 → L1–L5/N2/N3.

### Multi-business & MCP scoping

#### [multi-business-request/plan.md](multi-business-request/plan.md)

_Status:_ "Steps 1–15 of the blueprint are implemented" (L210-229); residual risks at L231-249.

- [L11-14](multi-business-request/plan.md#L11), L186-193 — `follow-up` — production deploy gated: "A
  sibling client plan must exist and be merged before the Step 9 contract cut ships."
- [L151-152](multi-business-request/plan.md#L151) — `checklist` — Verification 9 (manual A+B read,
  then single-target write) not recorded as done.
- [L173-177](multi-business-request/plan.md#L173), L241-243 — `deferred` — moving `user_context` to
  `(user_id, business_id)` is out of scope; preference fields are null for multi-business scope.
- [L204-208](multi-business-request/plan.md#L204) — `follow-up` — out-of-scope packages
  (gmail-listener, scraper-app, generators, scrapers) to follow up if they start calling with user
  context.
- [L233-236](multi-business-request/plan.md#L233) — `follow-up` — write-target args not exposed yet
  (`generateBalanceCharge`, `addTag`, `insertOrUpdateSalaryRecords`, ledger entry points still
  derive the owner from the primary admin context).
- [L237-240](multi-business-request/plan.md#L237) — `follow-up` — a real multi-business client
  (business switcher, scoped filters) is a separate effort and gates production rollout.
- [L244-246](multi-business-request/plan.md#L244) — `limitation` — per-record currency falls back to
  the primary business currency when a business has no admin-context row.
- [L247-249](multi-business-request/plan.md#L247) — `limitation` — integration tests run as
  superuser (RLS bypassed): "Validate enforcement against a non-superuser role before rollout."

#### [coherent-owner-scoping-for-mcp/plan.md](coherent-owner-scoping-for-mcp/plan.md)

_Status:_ Phase 0 "DONE (2026-08-01): PASS" (L42); in Phase 7 only the connector-gaps item is done
(L322-323). Phases 1–6 and the rest of Phase 7 unmarked.

- [L105-107](coherent-owner-scoping-for-mcp/plan.md#L105) — `follow-up` — re-run the four
  ownership/RLS queries against the local dev DB ("dev is the unverified environment").
- [L111-136](coherent-owner-scoping-for-mcp/plan.md#L111) — `task` — Phase 1: migration adding
  `owner_id` to the `extended_tags` view; `Tag.ownerId: UUID!` + resolver; codegen.
- [L140-170](coherent-owner-scoping-for-mcp/plan.md#L140) — `task` — Phase 2: forward
  `x-business-scope` centrally (`graphql-client.ts`, `registry.ts`, `execute.ts`, header-free
  `memberships.ts` + test, switch the 4 handlers).
- [L174-183](coherent-owner-scoping-for-mcp/plan.md#L174) — `task` — Phase 3: `byOwners` instead of
  `byBusinesses` in `charges.ts`; `reports.ts` uses `input.businessId` with a defensive assert.
- [L187-215](coherent-owner-scoping-for-mcp/plan.md#L187) — `task` — Phase 4: carry `businessName`
  through memberships; new `accounter_list_businesses` tool registered first.
- [L216-217](coherent-owner-scoping-for-mcp/plan.md#L216) — `follow-up` — when `MCP_TOOL_ALLOWLIST`
  enforcement lands ("parsed but unused"), include the discovery tool in the default allowlist.
- [L221-265](coherent-owner-scoping-for-mcp/plan.md#L221) — `task` — Phase 5: shared `businessIds`
  input, `ownerId` on every row, echoed `scope`, workflow text in tool descriptions.
- [L269-306](coherent-owner-scoping-for-mcp/plan.md#L269) — `task` — Phase 6: update 8 test files;
  add `businesses.test.ts`, `scope-forwarding.test.ts`, byte-budget test.
- [L310-321](coherent-owner-scoping-for-mcp/plan.md#L310), L324 — `task` — Phase 7 docs: mcp-server
  README, `spec.md` §7.3, `local-development.md` §6, `submission-checklist.md:40`.
- [L330-337](coherent-owner-scoping-for-mcp/plan.md#L330) — `limitation` — drift surfaces as
  `UPSTREAM_ERROR` rather than `AUTHORIZATION_ERROR`; non-UUID fixture business ids will hard-fail
  every tool call.
- [L339-341](coherent-owner-scoping-for-mcp/plan.md#L339) — `follow-up` — write-target re-pointing
  becomes live when the MCP gets write tools: "Note it in the spec."
- [L343-349](coherent-owner-scoping-for-mcp/plan.md#L343) — `question` — byte budget: "consider
  dropping the lookups' default `limit` from 500 to ~200".
- [L351-352](coherent-owner-scoping-for-mcp/plan.md#L351) — `limitation` — no codegen in
  `packages/mcp-server`; queries can drift from the schema silently.
- [L356-377](coherent-owner-scoping-for-mcp/plan.md#L356) — `checklist` — verification: tests, curl
  smoke sequence, server-side header check, two-business Claude Desktop loop.

#### [charges-filters/backend-followup.md](charges-filters/backend-followup.md)

_Status:_ "Status: implemented" (L3-6); outstanding items under "Still open".

- [L94-97](charges-filters/backend-followup.md#L94) — `follow-up` — no DB-level integration test;
  each `excluded*` field needs DB-backed cases (dropped, survives, in both lists, `NULL`
  description).
- [L98-101](charges-filters/backend-followup.md#L98) — `limitation` — `excluded_matches` roughly
  doubles the trigram-scan surface; the exclusion path "has not been profiled against a large charge
  table".
- [L102-105](charges-filters/backend-followup.md#L102) — `question` — `unbalanced` and
  `businessTrip` are accepted but ignored (`UNSUPPORTED_UPSTREAM_CHARGE_FILTER_FIELDS`): "worth
  either implementing or dropping from the schema".

### Performance & observability

#### [all-charges-performance-boost/enhancement-plan.md](all-charges-performance-boost/enhancement-plan.md)

_Status:_ none in this file; `findings.md` records results for Steps 1–2 only.

- [L53-61](all-charges-performance-boost/enhancement-plan.md#L53) — `task` — Step 3: short-circuit
  `invalidLedger` for charges with no transactions / documents / ledger; memoize `getChargeType` per
  request (F3, F7).
- [L63-64](all-charges-performance-boost/enhancement-plan.md#L63) — `deferred` — "not in this pass":
  persist a `ledger_validation` status invalidated on charge mutation.
- [L66-75](all-charges-performance-boost/enhancement-plan.md#L66) — `task` — Step 4: SQL
  `LIMIT/OFFSET` + `count(*) OVER()` in `getChargesByFilters`; push `byChargeTypes` into SQL (F4).
- [L70-72](all-charges-performance-boost/enhancement-plan.md#L70) — `question` — null-type charges
  still need JS resolution: over-fetch or accept approximate counts (undecided).
- [L77-81](all-charges-performance-boost/enhancement-plan.md#L77) — `task` — Step 5: move
  `missingInfoSuggestions` behind `@defer` in `charges-table.tsx` (F6).
- [L83-89](all-charges-performance-boost/enhancement-plan.md#L83) — `task` — Step 6: telemetry fixes
  (append `/v1/traces` in `builder.ts`; fix the `.env.template` OTLP endpoint) (F8).
- [L91-97](all-charges-performance-boost/enhancement-plan.md#L91) — `checklist` — append a results
  row to `findings.md` per step (only Steps 1–2 have rows).

#### [all-charges-performance-boost/findings.md](all-charges-performance-boost/findings.md)

_Status:_ baseline + results for Step 1 (~8.2s) and Step 2 (~8.3s); Steps 3–6 not recorded.

- [L89-118](all-charges-performance-boost/findings.md#L89) — `limitation` — F3 (`invalidLedger`
  regenerates the ledger for 100 charges), F4 (no SQL pagination), F6 (eager
  `missingInfoSuggestions`), F7 (`__isTypeOf` re-runs `getChargeType`) have no fix recorded.
- [L120-126](all-charges-performance-boost/findings.md#L120) — `limitation` — F8 OTLP exporter URL
  bug: "`.env.template` and/or the builder should be fixed" (workaround env var in use).
- [L154-158](all-charges-performance-boost/findings.md#L154) — `follow-up` — remaining cost after
  Step 2: per-charge staircase from `missingInfoSuggestions` / `getSimilarCharges` (Step 5),
  deferred `invalidLedger` (Step 3); "the main query (1.75s) remains step 4".

#### [operations/db-connection-pool.md](operations/db-connection-pool.md)

_Status:_ runbook, none stated.

- [L149-153](operations/db-connection-pool.md#L149) — `follow-up` — stop holding a connection across
  external calls; only document ingestion uses `releaseDbConnectionForExternalWork`. "Other
  external-I/O paths have not been converted yet."

#### [otel/spec.md](otel/spec.md)

_Status:_ none stated; rollout phases unmarked.

- [L41-45](otel/spec.md#L41) — `deferred` — out of scope: OTEL metrics and logs; frontend tracing;
  full distributed context propagation across other services.
- [L220-230](otel/spec.md#L220) — `checklist` — integration test with a mocked collector asserting
  the HTTP → GraphQL → pg span hierarchy and absence of sensitive fields (narrowed in prompt_plan,
  below).
- [L238-244](otel/spec.md#L238) — `checklist` — manual validation in Tempo / Grafana.
- [L246-254](otel/spec.md#L246) — `checklist` — acceptance criteria: traces visible in Tempo,
  correct hierarchy, no sensitive payloads, stable startup/shutdown, tests in CI, README section.
- [L256-266](otel/spec.md#L256) — `task` — rollout Phases 1–3, ending "Enable in production with
  conservative sampling and monitor overhead".

#### [otel/prompt_plan.md](otel/prompt_plan.md)

_Status:_ none stated; Steps 1–9 unmarked.

- [L140-147](otel/prompt_plan.md#L140) — `limitation` — import-first-line in `index.ts` instead of a
  `--require` preload is "often sufficient" — load-order risk (spec L270-271).
- [L186](otel/prompt_plan.md#L186) — `future` — "(Future: We might need a custom hook here for
  sanitization…)" for GraphQL instrumentation.
- [L207-210](otel/prompt_plan.md#L207) — `deferred` — full HTTP/PG instrumentation test was "hard";
  narrowed to asserting `sdk.start()` is called. The span-hierarchy and sensitive-field checks from
  the spec have no plan.

### Planned features

#### [cpi-provider/plan.md](cpi-provider/plan.md)

_Status:_ none stated; "Decisions (confirmed with user)" (L73-78): first PR is infrastructure only.

- [L82-277](cpi-provider/plan.md#L82) — `task` — Recommended approach §1–§5: `price_index_*`
  migration, CBS client, `PriceIndexSyncProvider`, `price-indexes` module / helpers / GraphQL,
  scheduling + env flag. No completion marker.
- [L88-90](cpi-provider/plan.md#L88) — `future` — other indexes (e.g. construction-input 200010)
  "can be added later"; only CPI synced now.
- [L157-160](cpi-provider/plan.md#L157) — `limitation` — early publications are recorded exactly
  only if seen by a same-day run; after downtime/backfill `published_on` reads as the 15th (manual
  correction).
- [L176-177](cpi-provider/plan.md#L176), L299-301 — `limitation` — the Singleton
  `FiatExchangeProvider` 24h cache "is never cleared after an upload".
- [L279-293](cpi-provider/plan.md#L279) (also L76-78) — `follow-up` — consumers (A): (1) securities
  real vs. inflationary gain per FIFO lot (SHAAM 6111 520/530/570); (2) fixed-asset sale adjusted
  cost; (3) linkage differences on late tax/VAT; (4) reconcile with `real_profit_loss_nis`; (5)
  client UI for CPI values + linkage calculator. _Note:_ `securities-semi-annual-report/plan.md`
  suggests (1) and (5) may be partly done.
- [L295-301](cpi-provider/plan.md#L295) — `follow-up` — (B) move the Bank of Israel exchange-rates
  fetch from scraper-app to a scheduled server job and fix the stale cache.
- [L305-310](cpi-provider/plan.md#L305) — `question` — CBS may block non-Israeli / datacenter IPs:
  "reachability from the production host must be checked before merge" (fallback: fetch from
  scraper-app).
- [L326-366](cpi-provider/plan.md#L326) — `checklist` — verification: unit golden cases,
  integration, manual (~901 rows), lint/generate.

#### [dynamic-report-change-tracking/plan.md](dynamic-report-change-tracking/plan.md)

_Status:_ none stated; decisions "settled during spec review"; Steps 0–4 unmarked.

- [L38-60](dynamic-report-change-tracking/plan.md#L38) — `task` — **Step 0, latent data-loss bug:**
  `buildReportTree` drops leaves with no sum, so Resave "permanently deletes that entity from the
  template". Fix first, as its own commit.
- [L62-105](dynamic-report-change-tracking/plan.md#L62) — `task` — Step 1: migration for `from_date`
  / `to_date` + snapshots table, and a second migration for its RLS policies ("Don't skip this half
  … tenant-isolation hole").
- [L107-179](dynamic-report-change-tracking/plan.md#L107) — `task` — Step 2: GraphQL surface
  (snapshot types, optional `snapshot` arg, `dynamicReportSnapshot` query).
- [L181-193](dynamic-report-change-tracking/plan.md#L181) — `task` — Step 3: server provider, helper
  and resolver changes.
- [L195-269](dynamic-report-change-tracking/plan.md#L195) — `task` — Step 4: client
  (`utils/diff.ts`, rendering, toolbar, container, hooks).
- [L35](dynamic-report-change-tracking/plan.md#L35) — `limitation` — sibling reordering is not
  tracked (no persisted order field).
- [L284-285](dynamic-report-change-tracking/plan.md#L284) — `deferred` — keep every snapshot "for
  now and revisit pruning if volume becomes real".
- [L287-305](dynamic-report-change-tracking/plan.md#L287) — `checklist` — verification
  (generate/lint, diff unit tests, migration cascades, manual e2e, integration).
- [L307-311](dynamic-report-change-tracking/plan.md#L307) — `deferred` — out of scope: ledger-record
  drill-down; changes summary panel; compare-mode toggle; restoring an old snapshot as the live
  layout; snapshot pruning.

#### [matching-screen/prompt_plan.md](matching-screen/prompt_plan.md)

_Status:_ none stated; no phase or prompt marked done.

- [L6-43](matching-screen/prompt_plan.md#L6) — `task` — Phases 1–4 (11 steps): schema, on-the-fly
  scoring service, `BY_DATE` / `BY_SCORE` resolver, merge validation, client codegen,
  `useChargeMatchQueue`, shell, sidebar/header, comparison cards, alternatives footer, accept/skip
  handlers.
- [L52-173](matching-screen/prompt_plan.md#L52) — `task` — Prompts 1–7 (code-gen prompts for the
  same steps).

#### [matching-screen/spec.md](matching-screen/spec.md)

_Status:_ none stated.

- [L13-14](matching-screen/spec.md#L13) — `deferred` — manual search and linking of charges is "out
  of scope for this specific UI".
- [L38-44](matching-screen/spec.md#L38) — `limitation` — `BY_SCORE` capped at 100 charges; if too
  slow, "prefer caching or asynchronous pre-calculation of scores over raising the cap".
- [L65-66](matching-screen/spec.md#L65) — `limitation` — UI warning: "Score-based sorting currently
  evaluates only the 100 most recent unmatched charges."
- [L111-131](matching-screen/spec.md#L111) — `checklist` — backend and frontend testing plan.

#### [securities-semi-annual-report/plan.md](securities-semi-annual-report/plan.md)

_Status:_ none stated for the report; prerequisite PRs (#4824, #4829–#4832, #4835) are on main.

- [L72-73](securities-semi-annual-report/plan.md#L72) — `limitation` — carried-forward losses
  "aren't in the books" → manual input.
- [L77](securities-semi-annual-report/plan.md#L77) — `question` — local dividends treated as exempt
  "by issuer country — verify".
- [L82](securities-semi-annual-report/plan.md#L82) — `limitation` — Poalim traded securities only;
  crypto and unlisted fall under Form 1399.
- [L83](securities-semi-annual-report/plan.md#L83) — `limitation` — "§92(א)(4) loss-vs-income offset
  is not modelled" (conflicts with the follow-up at L295-298 which adds it).
- [L100-281](securities-semi-annual-report/plan.md#L100) — `task` — §3 implementation (server
  `reports` module, helpers, resolver, changeset, client screen, routing, print CSS); no completion
  marker.
- [L169-170](securities-semi-annual-report/plan.md#L169), L292-293 — `limitation` — withholding on
  exempt local dividends, and expenses beyond what they offset, are "left for the annual return".
- [L283-300](securities-semi-annual-report/plan.md#L283) — `follow-up` — accountant review of the
  first draft: remove the advances file number; line 5 securities expenses from
  `FOREIGN_SECURITIES_FEES` + new `FINANCIAL_CONSULTANCY` slot; §92(a)(4) offset ordering; advance
  always shows an amount (incl. 0).
- [L333](securities-semi-annual-report/plan.md#L333) — `future` — optional integration test for
  `getOwnerExecutionsByTradeDates`.
- [L302-341](securities-semi-annual-report/plan.md#L302) — `checklist` — verification, ending with
  reconciliation against Form 867, `nominal_profit_loss_nis` and ledger balances, then accountant
  review of the H1 PDF.

### Tooling & infra

#### [architecture/scraper-app-refactor/plan.md](architecture/scraper-app-refactor/plan.md)

_Status:_ none stated (the `packages/scraper-app` package exists).

- [L5-6](architecture/scraper-app-refactor/plan.md#L5) — `deferred` — `scraper-local-app` stays
  untouched "until the new one is proven in production".
- [L353](architecture/scraper-app-refactor/plan.md#L353) — `future` — `scheduler.ts`: "stub for
  future scheduling, not implemented".
- [L415-424](architecture/scraper-app-refactor/plan.md#L415) — `checklist` — manual smoke test (8):
  vault creation wizard; wrong master password rejected; Poalim OTP prompt; unknown account blocks
  only its task; new transactions appear in client; re-run gives `inserted: 0, skipped: N`;
  `saveHistory: false` writes no file; no races in concurrent/sequential modes.
- [L430-431](architecture/scraper-app-refactor/plan.md#L430) — `deferred` — OS/email notifications
  on run completion: "Deferred — manual-only for now, no scheduling."
- [L432-433](architecture/scraper-app-refactor/plan.md#L432) — `limitation` — vault is single-user
  by design; each team member needs their own instance.
- [L434](architecture/scraper-app-refactor/plan.md#L434) — `limitation` — vault backup/export: "no
  mechanism today".
- [L435-436](architecture/scraper-app-refactor/plan.md#L435) — `follow-up` — once `scraper-app` is
  in production, open a PR removing `scraper-local-app`.

#### [architecture/scraper-app-refactor/blueprint.md](architecture/scraper-app-refactor/blueprint.md)

_Status:_ none stated; no chunk / step / prompt (0–20) marked done.

- [L146-149](architecture/scraper-app-refactor/blueprint.md#L146), L444-452, L1454-1490 — `task` —
  Chunk/Step/Prompt 20 hardening: ErrorBoundary per screen; "Test connection"
  (`GET /api/vault/test-connection`); loading skeletons; vault export hint in Settings; package
  README; "removal of all `TODO` stubs", leftover mock data and `console.log`.
- [L794-795](architecture/scraper-app-refactor/blueprint.md#L794) — `TODO` — Config Credentials tab
  "Test connection" button is a stub "that shows a TODO toast for now".
- [L356-357](architecture/scraper-app-refactor/blueprint.md#L356), L435-442, L1144-1146 —
  `follow-up` — upload client typed against a local stub schema until server mutations exist; Step
  19 re-points it to the real schema and removes MSW from the default setup.
- [L1436-1448](architecture/scraper-app-refactor/blueprint.md#L1436) — `checklist` — Prompt 19
  manual smoke test (8): vault wizard; wrong password; Poalim run launches headless Puppeteer;
  transactions appear in client; re-run `inserted: 0`; unknown account → `task-blocked`; classify
  then re-run succeeds; History shows correct counts. Gate: "Smoke checklist completed manually".

#### [mesh-v1-migration/plan.md](mesh-v1-migration/plan.md)

_Status:_ "Phases 1 and 2 and the Phase 3 cleanup are implemented in #529. Moving the SDK codegen to
v6 is the remaining follow-up." (L7-10)

- [L9-10](mesh-v1-migration/plan.md#L9), L241-243, L442-444 — `follow-up` — move SDK codegen to v6
  plugins (two-file layout) and fix the nullability fallout in `server`.
- [L52-54](mesh-v1-migration/plan.md#L52), L457 — `limitation` — `@oneOf` hint still lost on
  `mutationInput_updateExpense_input_paymentType_Input`: "report upstream if it matters".
- [L237-240](mesh-v1-migration/plan.md#L237) — `deferred` — porting `hashavshevet-mesh` /
  `payper-mesh` decided against; "feasible" if ever needed.
- [L244](mesh-v1-migration/plan.md#L244) — `deferred` — "Hand-written documents can come later."
- [L259](mesh-v1-migration/plan.md#L259) — `task` — owner action: `npm deprecate` both detached
  packages (completion not stated).
- [L428-433](mesh-v1-migration/plan.md#L428) — `checklist` — Phase 2.7 validation steps 3–4 (dev e2e
  with real credentials; staging smoke test) not among the "Verified locally" items.
- [L445-448](mesh-v1-migration/plan.md#L445) — `future` — optional: generate only the 13 operations
  `server` uses or hand-write tighter documents; switch to `createGatewayRuntime` if gateway plugins
  are wanted.
- [L458](mesh-v1-migration/plan.md#L458) — `limitation` — two codegen majors coexist until the v6
  follow-up.
- [L463-469](mesh-v1-migration/plan.md#L463) — `limitation` — "Not verified": real Green Invoice API
  calls (mocked only).

#### [claude-code-setup/spec.md](claude-code-setup/spec.md)

_Status:_ "Ready for implementation — Last updated: 2026-04-06". The setup (`CLAUDE.md`,
`.claude/settings.json`, rules / commands / hooks / agents / skills) exists in the repo, so the
checklist looks stale.

- [L467](claude-code-setup/spec.md#L467) — `follow-up` — graphql-module skill gotchas: "(Add more as
  discovered)".
- [L571-611](claude-code-setup/spec.md#L571) — `deferred` — Phase 8 hooks "(Post-Baseline)":
  PostToolUse prettier auto-format, Stop verification nudge; verify hook syntax against current docs
  first.
- [L655-668](claude-code-setup/spec.md#L655) — `deferred` — Phases 5–8 are progressive enhancement
  (slash commands / skills "should have"; subagents / hooks "nice to have").
- [L676-689](claude-code-setup/spec.md#L676) — `checklist` — §13 verification (9): "run the tests" →
  `yarn test` first try; `/memory` shows root `CLAUDE.md`, rules, settings; server context loads
  server `CLAUDE.md` + graphql-module skill; client context loads client `CLAUDE.md` +
  `client-components` rule; `/context` no budget warnings; `/generate`, `/test-module charges`,
  `/new-module example` work; permission allow/deny behaves; code-reviewer subagent spawns;
  `.cursor/rules/` still works.
- [L702](claude-code-setup/spec.md#L702) — `follow-up` — `.cursor/rules/` and `.claude/rules/` will
  drift: "Consolidate later if one wins."
- [L704](claude-code-setup/spec.md#L704) — `deferred` — add skills / hooks / agents after the team
  has baseline experience.
- [L710-713](claude-code-setup/spec.md#L710) — `future` — `.mcp.json` for Sentry / Linear / Slack if
  adopted.
- [L715-719](claude-code-setup/spec.md#L715) — `follow-up` — watch the skill-description character
  budget; raise `SLASH_COMMAND_TOOL_CHAR_BUDGET` if needed.
- [L721-725](claude-code-setup/spec.md#L721) — `follow-up` — periodically run `/memory` to audit and
  prune incorrect learnings.
- [L727-731](claude-code-setup/spec.md#L727) — `future` — evaluate agent teams
  (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`).
- [L733-736](claude-code-setup/spec.md#L733) — `future` — consider a shared `AGENTS.md` to stop
  Cursor / Claude rule drift.

### Docs with no open items

- [architecture/authentication.md](architecture/authentication.md)
- [architecture/authorization-pattern.md](architecture/authorization-pattern.md)
- [architecture/provider-cache-patterns.md](architecture/provider-cache-patterns.md) — its
  "Migration Checklist" (L79-86) is a standing audit procedure, not unfinished work.
- [operations/README.md](operations/README.md)
- [operations/logging.md](operations/logging.md)
- [multi-tenant-gmail-listener/data-flow.md](multi-tenant-gmail-listener/data-flow.md) — only notes
  that the legacy path stays active during rollout (L6-7, L149-150).
- [multi-business-request/blueprint.md](multi-business-request/blueprint.md) — `plan.md` says all 15
  steps are implemented.

---

## Archived projects (`docs/archive/`)

None of these docs states why it was archived or gives a final "done" status, so leftover items are
listed as written.

#### [archive/businesses-page-refactor/plan.md](archive/businesses-page-refactor/plan.md)

_Status:_ none stated; post-implementation notes at L161 ("Divergence (final)") and L194.

- [L50-52](archive/businesses-page-refactor/plan.md#L50) — `question` — `isAdminOwner` semantics:
  "Confirm exact semantics during implementation".
- [L180-192](archive/businesses-page-refactor/plan.md#L180) — `checklist` — verification steps 1–5
  (generate, build + lint, `BusinessUsageProvider` / `deleteBusiness` guard tests, manual GraphQL
  and UI checks) unmarked.

#### [archive/businesses-page-refactor/blueprint.md](archive/businesses-page-refactor/blueprint.md)

_Status:_ none stated; Steps A1–J1 unmarked.

- [L116-118](archive/businesses-page-refactor/blueprint.md#L116) — `question` — Step A3: choose the
  admin-owner semantics and note it in a code comment (same as plan L50).
- [L146-147](archive/businesses-page-refactor/blueprint.md#L146) — `limitation` — usage counts count
  a row once per column ("acceptable … note it in a code comment").
- [L362](archive/businesses-page-refactor/blueprint.md#L362) — `follow-up` — Step J1: update the
  plan's Verification if any step diverged (appears partly done).

#### [archive/demo-staging-dataset/demo-staging-dataset-spec.md](archive/demo-staging-dataset/demo-staging-dataset-spec.md)

_Status:_ "Status: Ready for Implementation" (L4, 2024-11-24); no completion statement.

- [L40](archive/demo-staging-dataset/demo-staging-dataset-spec.md#L40) — `deferred` — selective
  use-case filtering (`--include`) "deferred to post-MVP".
- [L43](archive/demo-staging-dataset/demo-staging-dataset-spec.md#L43) — `TODO` — performance for
  more than 100 use-cases ("threshold TBD").
- [L44](archive/demo-staging-dataset/demo-staging-dataset-spec.md#L44) — `limitation` — single admin
  business only (multi-tenant admin scenarios are a non-goal).
- [L116-124](archive/demo-staging-dataset/demo-staging-dataset-spec.md#L116) — `future` — use-case
  files in the layout not in the registry: `office-supplies-recurring`,
  `travel-expense-multi-receipt`, `subscription-revenue-monthly`,
  `consulting-invoice-partial-payment`, `stock-option-grant`.
- [L449-463](archive/demo-staging-dataset/demo-staging-dataset-spec.md#L449) — `question` —
  `createAdminBusinessContext` / `updateEnvFile` stubs: import from `seed.ts` or extract to a shared
  module.
- [L615](archive/demo-staging-dataset/demo-staging-dataset-spec.md#L615) — `future` — record count
  validation "(future: min count)".
- [L688](archive/demo-staging-dataset/demo-staging-dataset-spec.md#L688) — `question` — invalid
  fixture: "skip or fail (configurable)".
- [L796-799](archive/demo-staging-dataset/demo-staging-dataset-spec.md#L796) — `future` — automated
  health check (Render deploy webhook → Playwright suite).
- [L821-824](archive/demo-staging-dataset/demo-staging-dataset-spec.md#L821) — `future` — exchange
  rates Option B: live API with hardcoded fallback + audit timestamp.
- [L859](archive/demo-staging-dataset/demo-staging-dataset-spec.md#L859) — `limitation` — "No
  password hashing in MVP (auth via env whitelist only)".
- [L875-879](archive/demo-staging-dataset/demo-staging-dataset-spec.md#L875) — `future` — seed
  optimizations "(if needed)": batch inserts, parallel use-cases, deferred index creation.
- [L908-918](archive/demo-staging-dataset/demo-staging-dataset-spec.md#L908) — `follow-up` — runbook
  `docs/runbooks/staging-demo-seed.md` (does not exist).
- [L924-937](archive/demo-staging-dataset/demo-staging-dataset-spec.md#L924) — `checklist` — §16
  acceptance criteria (12): ≥ 3 categories; 5+ use-cases; stable UUIDs; refuses
  `NODE_ENV=production`; < 60s; ledger validation catches missing admin / charge mismatch /
  unbalanced; Render staging build runs seed + validate; "Add New Use-Case" tutorial; ≥ 1 use-case
  with ledger expectations; FX rates USD/EUR/GBP → ILS; VAT 17%; enums in fixtures.
- [L941-977](archive/demo-staging-dataset/demo-staging-dataset-spec.md#L941) — `future` — §17
  post-MVP: selective loading, volume multipliers, live FX (ECB / CoinGecko), use-case dependency
  graph, HTML catalog, ledger snapshot testing.
- [L1010-1011](archive/demo-staging-dataset/demo-staging-dataset-spec.md#L1010) — `follow-up` —
  assign a developer, create a tracking issue, estimate effort.

#### [archive/demo-staging-dataset/demo-staging-dataset-todo.md](archive/demo-staging-dataset/demo-staging-dataset-todo.md)

_Status:_ "Status: In Progress" (L4); Phases 1–8 and E1–E5 checked; everything from L128 down
unchecked. (L11 is the legend, not a task.)

- [L97](archive/demo-staging-dataset/demo-staging-dataset-todo.md#L97) — `task` — E6 (blocked):
  confirm performance < 5s on a typical dataset "(blocked: needs seeded DB)".
- [L130-141](archive/demo-staging-dataset/demo-staging-dataset-todo.md#L130) — `checklist` —
  acceptance criteria verification (11; same themes as spec §16).
- [L145-149](archive/demo-staging-dataset/demo-staging-dataset-todo.md#L145) — `task` — deployment
  (5): Render build command with seed + validate; `ALLOW_DEMO_SEED=1` in staging;
  `AUTHORIZED_USERS`; confirm `DEFAULT_FINANCIAL_ENTITY_ID`; run `yarn validate:demo` after deploy.
- [L153-158](archive/demo-staging-dataset/demo-staging-dataset-todo.md#L153) — `checklist` —
  post-seed manual staging UI checks (6): demo login; charges across categories; FX converted ILS;
  dividend ledger balanced; refund payment + reversal; VAT consistent.
- [L162-168](archive/demo-staging-dataset/demo-staging-dataset-todo.md#L162) — `future` —
  maintenance (7): add a use-case; annual FX update; VAT change row; selective loading;
  `volumeMultiplier`; Zod validation; HTML catalog.
- [L172-177](archive/demo-staging-dataset/demo-staging-dataset-todo.md#L172) — `task` — quality
  checks (6): no orphaned helpers; imports resolve; no duplicate UUID names; `{{ADMIN_BUSINESS_ID}}`
  replacement; validate exit codes; consistent log prefixes.
- [L181-184](archive/demo-staging-dataset/demo-staging-dataset-todo.md#L181) — `limitation` — risk
  tracking (4): schema changes needing fixture updates; missing enum exports; FK failures; env
  misconfiguration.
- [L188-191](archive/demo-staging-dataset/demo-staging-dataset-todo.md#L188) — `task` — rollback
  procedure (4).
- [L235-241](archive/demo-staging-dataset/demo-staging-dataset-todo.md#L235) — `deferred` — next
  additions: include/exclude flags, `volumeMultiplier`, Zod, HTML catalog, live FX API.

#### [archive/demo-staging-dataset/demo-staging-dataset-prompt-plan.md](archive/demo-staging-dataset/demo-staging-dataset-prompt-plan.md)

_Status:_ "Ready for Sequential Execution" (L4); no prompt marked done.

- [L104-107](archive/demo-staging-dataset/demo-staging-dataset-prompt-plan.md#L104), L674-687 —
  `deferred` — Phase 9 / Prompt 31 optional Zod validation: "Defer this to post-MVP unless
  requested."
- [L299](archive/demo-staging-dataset/demo-staging-dataset-prompt-plan.md#L299) — `deferred` — "Do
  not yet migrate the full context from seed.ts (postponed)".
- [L695-704](archive/demo-staging-dataset/demo-staging-dataset-prompt-plan.md#L695) — `checklist` —
  post-implementation checklist (10): TS compiles; UUID/registry unit tests; integration test with
  `ALLOW_DEMO_SEED=1`; production guard; validate exit codes; developer guide accurate; scripts
  callable; `.js` imports; no orphaned code; doc references match.
- [L708-753](archive/demo-staging-dataset/demo-staging-dataset-prompt-plan.md#L708) — `future` —
  selective loading CLI, volume multipliers, HTML catalog, live FX with fallback.
- [L812](archive/demo-staging-dataset/demo-staging-dataset-prompt-plan.md#L812), L815 — `follow-up`
  — add 2+ more use-cases to reach 5+; monitor < 60s seed time.

#### [archive/demo-staging-dataset/demo-staging-dataset-ledger-validation/spec.md](archive/demo-staging-dataset/demo-staging-dataset-ledger-validation/spec.md)

_Status:_ none stated; all success criteria unchecked.

- [L150](archive/demo-staging-dataset/demo-staging-dataset-ledger-validation/spec.md#L150), L749 —
  `TODO` — "Validate VAT configuration (TODO - future)";
  `// TODO: Check vat_value table for default percentage`.
- [L1149-1171](archive/demo-staging-dataset/demo-staging-dataset-ledger-validation/spec.md#L1149) —
  `future` — §8.1 Phase 2: VAT validation; batch / parallel validation + progress; configurable
  severity and tolerances; JSON / HTML / CSV reports.
- [L1173-1191](archive/demo-staging-dataset/demo-staging-dataset-ledger-validation/spec.md#L1173) —
  `future` — §8.2 CI workflow `validate-demo-data.yml` (seed + validate on push/PR).
- [L1199-1214](archive/demo-staging-dataset/demo-staging-dataset-ledger-validation/spec.md#L1199) —
  `checklist` — §9.1 success criteria (7) and §9.2 definition of done (6).

`demo-staging-dataset-ledger-validation/prompt-plan.md` — no open items stated.

#### [archive/demo-test-data/demo-test-data-plan.md](archive/demo-test-data/demo-test-data-plan.md)

_Status:_ "Prepared for implementation. This document will evolve" (L573); S1–S5 ✅, §15 CI
"Implemented".

- [L21-26](archive/demo-test-data/demo-test-data-plan.md#L21), L137-138 — `deferred` — non-goals:
  scraper ingestion simulation, Gmail / file-system ingestion, load testing, full charge-type
  coverage; matching logic tests.
- [L140-147](archive/demo-test-data/demo-test-data-plan.md#L140) — `future` — §8 income roadmap:
  Income A (ILS invoice, later payment), Income B (FX, partial payments), exchange revaluation.
- [L337](archive/demo-test-data/demo-test-data-plan.md#L337), L340 — `follow-up` — CI coverage
  "threshold enforcement pending"; optional migration dry-run validation.
- [L385-395](archive/demo-test-data/demo-test-data-plan.md#L385) — `future` — §17 Phase 2 (income
  fixtures, revaluation, `autoMatchCharges` tests, negative tests) and Phase 3 (raw scraper-table
  insertion, raw → ledger e2e).
- [L397-411](archive/demo-test-data/demo-test-data-plan.md#L397) — `checklist` — §18 Phase 1
  acceptance criteria (no status).
- [L425-430](archive/demo-test-data/demo-test-data-plan.md#L425) — `future` — §20 extension hooks:
  ledger snapshot serialization, seed feature flags, `yarn demo:export --scenario`.
- [L434-449](archive/demo-test-data/demo-test-data-plan.md#L434) — `follow-up` — ledger test
  injector "requires ongoing maintenance as ledger logic evolves".
- [L559-569](archive/demo-test-data/demo-test-data-plan.md#L559) — `question` — §24 open questions:
  FX seeding vs mock; fixture diff tooling; document upload simulation (deferred to Phase 3);
  extract `buildAdminContextFromDb(pool, businessName)` to remove ~100 duplicated lines per test.
- [L575-602](archive/demo-test-data/demo-test-data-plan.md#L575) — `limitation` — §25 ledger test
  coverage gaps (11): duplicate inserts on re-run with `insertLedgerRecordsIfNotExists`, VAT legs,
  rounding, FX date alignment, secondary entities, charge lock, description/reference, fiscal
  boundaries, post-lock immutability, foreign/local reconciliation, unbalanced-business exceptions.
- [L604-630](archive/demo-test-data/demo-test-data-plan.md#L604) — `follow-up` — §26 "Ledger
  Coverage Hardening" milestone (10 steps; see also prompt-plan Milestone 7).

#### [archive/demo-test-data/demo-test-data-todo.md](archive/demo-test-data/demo-test-data-todo.md)

_Status:_ "[x] All TODO items in this file are completed (through Milestone 6 …)" (L916); last
updated 2025-11-23.

- [L95-97](archive/demo-test-data/demo-test-data-todo.md#L95) — `deferred` — S6 CLI wrapper: "Add
  package.json script" still unchecked (Prompt 18 reports `seed:admin` scripts added).
- [L523-540](archive/demo-test-data/demo-test-data-todo.md#L523) — `deferred` — S18 `clearData`
  utility (7 boxes): "deferred - not critical for current test isolation strategy".
- [L857-888](archive/demo-test-data/demo-test-data-todo.md#L857) — `checklist` — environment setup:
  prerequisites (4), env config (2), DB setup (3).
- [L896-907](archive/demo-test-data/demo-test-data-todo.md#L896) — `checklist` — verification: code
  quality (4), test quality (5).
- [L924-940](archive/demo-test-data/demo-test-data-todo.md#L924) — `future` — income scenarios (3),
  advanced testing (4), source ingestion Phase 3 (4).
- [L944-947](archive/demo-test-data/demo-test-data-todo.md#L944) — `future` — CI/CD (3 unchecked:
  GitHub Actions workflow, PR test runs, performance benchmarks); coverage "threshold enforcement
  pending" (L946).

#### [archive/demo-test-data/demo-test-data-prompt-plan.md](archive/demo-test-data/demo-test-data-prompt-plan.md)

_Status:_ Prompts 1–7 and 18–23 "✅ COMPLETED"; Prompts 8–17 no status line.

- [L15](archive/demo-test-data/demo-test-data-prompt-plan.md#L15) — `deferred` — "Defer ingestion
  (scrapers, Gmail) until Phase 3."
- [L101](archive/demo-test-data/demo-test-data-prompt-plan.md#L101), L124 — `deferred` — S6 CLI
  wrapper and S18 `clearData` micro-steps (no prompt written for S18).
- [L744-745](archive/demo-test-data/demo-test-data-prompt-plan.md#L744) — `future` — income flows,
  multi-currency, partial payments in future phases.
- [L747-784](archive/demo-test-data/demo-test-data-prompt-plan.md#L747) — `future` — Milestone 7
  "Ledger Coverage Hardening (Planned)", Chunks 7.1–7.10 + acceptance criteria (7).
- [L786-797](archive/demo-test-data/demo-test-data-prompt-plan.md#L786) — `follow-up` — follow-up
  prompts 25.1–25.10 exist as titles only.

#### [archive/demo-test-data/architectural-improvements-s1-s3.md](archive/demo-test-data/architectural-improvements-s1-s3.md)

_Status:_ all Critical / High / Medium items implemented (L9-11); "Ready for S4".

- [L276](archive/demo-test-data/architectural-improvements-s1-s3.md#L276) — `follow-up` — "Low
  Priority (Future Phase) - Partially Completed" (only atomic writes done).
- [L408-411](archive/demo-test-data/architectural-improvements-s1-s3.md#L408) — `deferred` —
  structured logging; ADR documents; shared pool singleton; prepared statements.

#### [archive/demo-test-data/architectural-improvements-milestone2.md](archive/demo-test-data/architectural-improvements-milestone2.md)

_Status:_ "Milestone 2 foundation is stable … No blocking technical debt" (L267-270).

- [L13-15](archive/demo-test-data/architectural-improvements-milestone2.md#L13), L197-202 —
  `limitation` — migration guard test deliberately fails when the DB is behind.
- [L155-156](archive/demo-test-data/architectural-improvements-milestone2.md#L155) — `future` —
  coverage threshold enforcement; Node/OS matrix and caching.
- [L236-245](archive/demo-test-data/architectural-improvements-milestone2.md#L236) — `follow-up` —
  Milestone 3+ next steps: CI coverage thresholds (~80%), migration dry-run job, Node/OS matrix,
  structured JSON diagnostics, schema-drift report (factory layer / fixture loader later delivered).
- [L249-255](archive/demo-test-data/architectural-improvements-milestone2.md#L249) — `limitation` —
  no automatic migrations in tests; silent fallback if env-isolation temp file fails; manual upgrade
  to pass the migration guard.

#### [archive/demo-test-data-infrastructure-consolidation/spec.md](archive/demo-test-data-infrastructure-consolidation/spec.md)

_Status:_ "ready for direct implementation" (L190-191); progress update (L193-200) records partial
work on steps 1–3.

- [L19-26](archive/demo-test-data-infrastructure-consolidation/spec.md#L19) — `task` — functional
  requirements: single UUID implementation; only `seedAdminCore`; demo validator as source of truth;
  command renames; "all deprecated code must be removed immediately".
- [L30](archive/demo-test-data-infrastructure-consolidation/spec.md#L30), L73-76 — `follow-up` —
  backward compat for one release cycle; `makeUUIDLegacy` adapter is short-lived and "must be
  removed after all code is updated".
- [L71](archive/demo-test-data-infrastructure-consolidation/spec.md#L71), L82-83 — `task` — lint
  rule or CI check blocking legacy UUID helpers (`__tests__/factories/ids.ts`).
- [L95-98](archive/demo-test-data-infrastructure-consolidation/spec.md#L95) — `task` — refactor
  `ledger-assertions.ts` to wrap `validateLedgerRecords()`.
- [L102-108](archive/demo-test-data-infrastructure-consolidation/spec.md#L102) — `task` — command
  renames + docs/CI mirror; `question`: add `seed:reset-staging` "if destructive reset is needed".
- [L110-122](archive/demo-test-data-infrastructure-consolidation/spec.md#L110) — `question` — moving
  foundation seeders into module helpers "is optional".
- [L148-186](archive/demo-test-data-infrastructure-consolidation/spec.md#L148) — `task` — testing
  plan, implementation steps 1–7 and deliverables (incl. developer migration notes).

#### [archive/demo-test-data-infrastructure-consolidation/todo.md](archive/demo-test-data-infrastructure-consolidation/todo.md)

_Status:_ progress note dated 2025-11-30 (L8-25); 12 checked, 43 unchecked.

- [L23-25](archive/demo-test-data-infrastructure-consolidation/todo.md#L23) — `follow-up` — pending:
  `seed-demo-data.ts` still calls `createAdminBusinessContext`; ledger assertions not migrated to
  `validateLedgerRecords()`; CI/ESLint legacy-import checks not added.
- [L34-41](archive/demo-test-data-infrastructure-consolidation/todo.md#L34) — `follow-up` — checked
  but partial ("many tests still import legacy helper", "final script renames pending QA"); 4
  high-level acceptance criteria unchecked.
- [L67-71](archive/demo-test-data-infrastructure-consolidation/todo.md#L67) — `task` — Chunk 2: 2.3
  convert factories to two-arg `makeUUID`; 2.4 migration note.
- [L75-81](archive/demo-test-data-infrastructure-consolidation/todo.md#L75) — `task` — Chunk 2b (5):
  move `seedExchangeRates` / `seedVATDefault`, update imports, keep idempotent SQL + tests, docs.
- [L88-95](archive/demo-test-data-infrastructure-consolidation/todo.md#L88) — `task` — Chunk 3:
  migrate `seed-demo-data.ts` to `seedAdminCore()`; deprecate/remove `createAdminBusinessContext`.
- [L99-105](archive/demo-test-data-infrastructure-consolidation/todo.md#L99) — `task` — Chunk 4 (4):
  canonical ledger validation in `ledger-assertions.ts`, remove duplicates, unit tests.
- [L109-120](archive/demo-test-data-infrastructure-consolidation/todo.md#L109) — `task` — Chunk 5:
  final renames pending; remnant references; 5.3 deprecation warnings in seed scripts.
- [L126-131](archive/demo-test-data-infrastructure-consolidation/todo.md#L126) — `task` — Chunk 6:
  factories import canonical `makeUUID` and drop `ids.ts`; remove inline `randomUUID` workarounds.
- [L135-144](archive/demo-test-data-infrastructure-consolidation/todo.md#L135) — `task` — Chunk 7
  testing (3): unit tests (`resolveAdminPlaceholders`, `seedAdminCore` idempotency), integration
  tests, run `yarn test`.
- [L148-153](archive/demo-test-data-infrastructure-consolidation/todo.md#L148) — `task` — Chunk 8:
  remove `ids.ts`, `admin-context.ts`, ad-hoc validation.
- [L157-162](archive/demo-test-data-infrastructure-consolidation/todo.md#L157) — `task` — Chunk 9:
  canonical imports; full build/test + seed/validate; CI changes.
- [L166-173](archive/demo-test-data-infrastructure-consolidation/todo.md#L166) — `task` — Chunk 10:
  migration notes, update prompt_plan/spec, README "how to run".
- [L179-185](archive/demo-test-data-infrastructure-consolidation/todo.md#L179) — `task` — lint/CI
  enforcement (ESLint/regex rule; CI smoke job).
- [L191-194](archive/demo-test-data-infrastructure-consolidation/todo.md#L191) — `task` — rollback /
  compatibility plan (3).
- [L200-205](archive/demo-test-data-infrastructure-consolidation/todo.md#L200) — `task` — ownership
  & timeline (3).
- [L222-225](archive/demo-test-data-infrastructure-consolidation/todo.md#L222) — `task` —
  post-completion cleanup: remove `makeUUIDLegacy` and `ids.ts`; CI gate; CHANGELOG.

#### [archive/demo-test-data-infrastructure-consolidation/prompt_plan.md](archive/demo-test-data-infrastructure-consolidation/prompt_plan.md)

_Status:_ "Progress Update (automated)" (L21-32); chunks / prompts unmarked.

- [L28-32](archive/demo-test-data-infrastructure-consolidation/prompt_plan.md#L28) — `follow-up` —
  legacy helper still imported "for compatibility"; root `package.json` scripts "still require
  renaming".
- [L36-100](archive/demo-test-data-infrastructure-consolidation/prompt_plan.md#L36), L194-417 —
  `task` — Chunks 1–10 (incl. 2b) and Prompts 1.1–10.2 unmarked.

#### [archive/dynamic-report-refactor/spec.md](archive/dynamic-report-refactor/spec.md)

_Status:_ none stated.

- [L23-24](archive/dynamic-report-refactor/spec.md#L23), L184-187 — `limitation` — lock/unlock
  mutations exist but aren't exposed on screen (by design).
- [L206-218](archive/dynamic-report-refactor/spec.md#L206) — `future` — "Future step (separate work
  item)": replace `BusinessExtendedInfo` with a purpose-built leaf view (fixed columns, optional
  foreign-currency pairs, per-entity currency toggle).

#### [archive/dynamic-report-refactor/blueprint.md](archive/dynamic-report-refactor/blueprint.md)

_Status:_ Progress snapshot (L32-48): B, F, I done; M done with mock data; G, H, J, K, L, N partial;
A, C, D, E, O not started.

- [L19-26](archive/dynamic-report-refactor/blueprint.md#L19) — `limitation` — baseline gaps "must be
  addressed before going to production": `cross-tree-drop.ts` missing ("the app does not build");
  `CustomData` missing `hebrewText`; delete-branch drops deeper descendants; server type / Zod still
  on old `descendantSortCodes` shape.
- [L33-47](archive/dynamic-report-refactor/blueprint.md#L33) — `task` — not started: A (backend
  schema + Zod + migration helper), C (`buildInitialBankTree`), D (`buildReportTree`), E (client
  legacy migration), O (CSV export). Partial: G, H (template-switch guard), J (tests), K (reroot), L
  (mutations stubbed), M (mock `isLegacy`), N (no URL params, no locked-template guard).
- [L88-138](archive/dynamic-report-refactor/blueprint.md#L88) — `task` — Chunks 0–13 remaining work
  (Chunk 13 has no prompt).
- [L815-829](archive/dynamic-report-refactor/blueprint.md#L815) — `checklist` — definition of done
  (13 bullets).

---

## Doc inconsistencies spotted

Not tasks in themselves, but worth fixing while touching these docs:

- **Broken links:** [super-user/super-admin-runbook.md:106](super-user/super-admin-runbook.md#L106)
  links to `./plan.md`, which doesn't exist;
  [architecture/scraper-app-refactor/blueprint.md:5](architecture/scraper-app-refactor/blueprint.md#L5)
  cites `docs/scraper-app-refactor/plan.md` (moved under `architecture/`).
- **Password-setup emails:** user-authentication-plan blueprint (L2314, L2341, L2395, L2399), spec
  (L75, L1775-1776) and prompt_plan (L5595, L5998 ✅) still say Auth0 sends them; the 2026-10 notes
  ([spec.md:81](user-authentication-plan/spec.md#L81),
  [auth0-setup.md:176](user-authentication-plan/auth0-setup.md#L176)) say it is not implemented.
- **Auth plan never archived:** prompt_plan L4754 / L5035-5043 say to move it to
  `docs/archive/user-authentication-plan/` and create `migration-summary.md`; neither exists.
- **Wrong step numbers:** auth blueprint L699-705 says old Step 2.9 moved to "Step 4.9" (it's 4.10);
  prompt_plan L3847 says "Prompt 4.7 (provider migration)" (it's 4.8).
- **Stale idempotency audit:**
  [release-checklist.md:13](multi-tenant-gmail-listener/release-checklist.md#L13) still credits
  `EmailIngestionIdempotencyProvider`; security review H2
  ([L69](multi-tenant-gmail-listener/security-architecture-review.md#L69)) says it was deleted.
- **CPI consumers:** [cpi-provider/plan.md:279](cpi-provider/plan.md#L279) lists securities CPI and
  a CPI calculator as future consumers, but `securities-semi-annual-report/plan.md` (L69-71,
  L185-186, L243) describes them as existing.
- **Super-admin scope:** [super-admin-runbook.md:9](super-user/super-admin-runbook.md#L9) says
  super-admin only gates `bootstrapNewClient`; `cpi-provider/plan.md` L260-262 also guards
  `syncPriceIndexes`.
- **Redaction list:** `user-providers-credentials` asks to redact `id`, `secret`, `apiToken`;
  [operations/logging.md:92](operations/logging.md#L92) now redacts keys ending in
  token/secret/password/apiKey, but bare `id` is not covered.
- **Archive contradictions:** `seedAdminCore` in `seed-demo-data.ts` is "done" per consolidation
  spec L200 / prompt_plan L28 but "pending" per todo L23, L88-90; demo-test-data-todo L944 leaves
  the GitHub Actions workflow unchecked while L236-242 (H5) say it was added; S6 CLI wrapper (L97)
  unchecked though Prompt 18 added the scripts.
- **Garbled / incomplete text:** demo-test-data-prompt-plan L222-263 merges Prompts 2 and 3;
  demo-staging-dataset-prompt-plan L58-84 lists Prompts 21a–21f with no prompt text; consolidation
  prompt_plan L243 points to `packages/server/src/fixtures/deterministic-uuid.ts` (canonical path is
  `demo-fixtures/helpers/deterministic-uuid.ts`).
- **Invalid SQL:** ledger-validation
  [prompt-plan.md:1258](archive/demo-staging-dataset/demo-staging-dataset-ledger-validation/prompt-plan.md#L1258)
  uses `UPDATE … LIMIT 1` (not valid in PostgreSQL; spec L1109 has the correct subquery form).
- **FR8 scope:** ledger-validation prompt-plan Step 2.4 (L225-257) implements only an exact-count
  check; spec FR8 (L80-84) also asks for minimum counts.
