# MCP Connector — Open TODO

Everything still outstanding for `@accounter/mcp-server`, consolidated from
[`connector-gaps-and-decisions.md`](./connector-gaps-and-decisions.md) and
[`owner-scoping-review.md`](./owner-scoping-review.md) so there is one list to work from. Those two
documents remain the source of detail — each item below links back to its section rather than
restating the analysis.

Last consolidated 2026-08-02, after all owner-scoping work (#4089–#4097) merged into
`mcp-owner-scoping`.

**Status of the connector today:** working end-to-end against Claude Desktop with a pre-registered
Auth0 client, read-only, five curated tools, business scope enforced by RLS upstream. Not
publishable — see B1.

---

## B — Blockers (nothing ships publicly until these clear)

### B1. Auth0 DCR is rejected by Claude

`POST /oidc/register` returns `201`, Claude reports "Couldn't register" and never reaches
`/authorize`. Likely cause: Auth0's response omits `grant_types` / `response_types`, which RFC 7591
expects echoed back.

A published connector **must** use DCR — arbitrary users cannot be handed a confidential client
secret. The pre-registered-client workaround only covers developers and small trusted groups.

**Not fixable in this repository.** Registration happens on Anthropic's backend.

- [ ] Report the interop bug to Anthropic and/or Auth0 (reproduction data is in the Auth0 tenant
      logs, type `sapi`, "Dynamic client registration")
- [ ] Decide whether a fronting authorization server implementing RFC 7591 is an acceptable fallback
      → see D2

Source: gap 1, F6.

---

## D — Decisions to make

These need a human call, not implementation. Several gate work below.

| #   | Decision                                                                                                                                                                                                      | Blocks                          | Source                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------- |
| D1  | **Audience strategy** — accept MCP and GraphQL sharing `https://api.accounter.com`, or pursue separation. Constrained: Auth0 ignores RFC 8707 `resource`, so a distinct audience is not currently obtainable. | production security posture     | gap 3                  |
| D2  | **DCR interop** — who owns reporting it, and is a fronting authorization server an acceptable fallback if upstream does not fix it?                                                                           | B1, any published connector     | gap 1                  |
| D3  | **`MCP_TOOL_ALLOWLIST`** — implement enforcement, or delete the claim from the docs. Today the docs describe a control that does not exist.                                                                   | I1, phase 2 write tools         | gap 2                  |
| D4  | **Production hosting** — stable domain + TLS for the MCP origin. `MCP_PUBLIC_BASE_URL` must match it exactly.                                                                                                 | I5, leaving dev tunnels         | gap 4                  |
| D5  | **Third-party posture** — if a published connector is the goal, the reverted Auth0 tenant changes become permanent production requirements, not debugging artifacts.                                          | D1, D2, production tenant setup | tenant-changes section |
| D6  | **Rate-limit keying** — accept per-scope quota multiplication, key on `userId\|toolName`, or add a per-user aggregate ceiling.                                                                                | I2                              | F2                     |

---

## I — Implementation gaps

Ranked by when they start to hurt, not by size.

### I1. Enforce `MCP_TOOL_ALLOWLIST` — **high before phase 2**

**Gated on D3.** `env.server.toolAllowlist` is parsed and never read; every registered tool is
exposed regardless. Harmless while phase 1 is read-only; a real control gap the moment mutating
tools land.

- [ ] Wire the allowlist into the registry (or, if D3 goes the other way, remove the claim from
      `config/env.ts` and the docs)
- [ ] **`accounter_list_businesses` must be in the default allowlist.** Omitting it removes the only
      way to discover a `businessId`, and it fails _silently_ — the other tools keep working, just
      unscoped and defaulted to all memberships

Source: gap 2, F5.

### I2. Rate-limit quota multiplies with scope subsets — **medium**

**Gated on D6.** `rateLimitKey` is `userId|sortedScope|toolName`. Sorting defeats permutation abuse,
but distinct _subsets_ remain distinct buckets. Phase 5 gave two more tools a `businessIds` input —
they previously had one bucket each — so a caller with N businesses can address up to 2^N−1 buckets
per tool.

Not a tenant-isolation issue: every subset is already authorized. It weakens abuse protection and
upstream load control on exactly the tools that now push RLS-scoped work upstream. Memory is bounded
by the existing sweep, so this is quota, not a leak.

- [ ] Implement whichever option D6 selects

Source: F2.

### I3. Replace the Auth0 test application — **low-medium**

The connector authenticates as the Accounter API's auto-created _"Accounter API (Test
Application)"_, renamed. Accepted deliberately during bring-up. Latent problems: Auth0 deletes it
with its API, it backs the API's **Test** tab (anyone rotating that secret breaks the connector),
and it is an M2M client running an Authorization Code flow.

- [ ] Create a purpose-built **Regular Web Application** (callback
      `https://claude.ai/api/mcp/auth_callback`, Authorization Code + Refresh Token grants)
- [ ] Move the user-delegated grant on the Accounter API to the new app
- [ ] Update the connector's client ID/secret in Claude Desktop
- [ ] Restore the test application's original name

Best paired with any other change that already requires re-granting API access.

Source: gap 7.

### I4. `POST /mcp/` returns 404 — **low**

Only the exact path `/mcp` is routed. A trailing slash looks correct and fails silently, and 404s
never reach the auth layer, so `/metrics` records nothing — this cost real debugging time.

- [ ] Tolerate a trailing slash

Source: gap 5.

### I5. Stable tunnel / origin for development — **low (friction)**

`cloudflared` quick tunnels get a new hostname on every restart, silently invalidating both
`MCP_PUBLIC_BASE_URL` and the connector URL. It rotated twice in one session.

- [ ] Set up a named tunnel (or equivalent) for ongoing development
- [ ] Production origin is D4

Source: gap 4.

---

## O — Operational / Auth0 follow-ups

### O1. Return the M2M Management API scopes to least privilege

Scopes were widened on the `accounter` M2M application during debugging: `read:connections`,
`update:connections`, `read:resource_servers`, `update:resource_servers`, `read:logs`.

These credentials are the root `.env` `AUTH0_CLIENT_ID`/`SECRET` **used by the running server**, so
the widening applies to the application process itself, not just to manual tooling.

- [ ] Drop back to the original four `*:users` scopes
- [ ] Consider keeping `read:logs` — read-only, and the single most useful diagnostic in this work

Source: tenant-changes section.

### O2. Re-run the Phase 0 RLS checks against the local dev database

The `extended_tags` / RLS pre-flight was verified on **production**. Ownership and role attributes
are environment-specific, so **dev is the unverified environment here, not prod**.

- [ ] Re-run the four catalog queries against the local dev database before assuming dev behaves the
      same

Source: Phase 0 section.

### O3. Repo root `.env` points at production

Noted in passing in the Phase 0 write-up: the production database is "the target the repo root
`.env` points at". Anything reading that file — codegen, migrations, seeds, DB-backed tests —
targets production by default.

- [ ] Point the root `.env` at the local database and keep production credentials in a separate,
      explicitly named file

Source: Phase 0 section (parenthetical).

---

## X — Documentation debt

### X1. `submission-checklist.md` omits client registration

The checklist covers the server's OAuth discovery obligations but never mentions DCR or how clients
obtain credentials, so it reads as complete while B1 is open.

- [ ] Add a client-registration line item
- [ ] List B1 (gap 1) under "Known gaps to disclose at submission"

Source: gap 6, F6.

---

## A — Accepted for now (revisit only if the trigger fires)

Recorded so nobody re-discovers them as bugs. Each has a stated condition that would make it live.

| Item                                                                                                                                                                                                                                                                | Trigger to revisit                                                                                                        | Source |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Empty-scope widening path.** An all-blank scope would omit the header, which upstream reads as "all memberships". Unreachable _by construction, not by guard_ — `coerceMembership` rejects empty ids and both scope builders draw only from accepted memberships. | Any change relaxing membership coercion. A two-line guard in `executeOnce` would remove the dependency on that invariant. | F3     |
| **Asymmetric scope bound.** `MAX_REQUESTED_BUSINESS_IDS = 50` bounds caller-requested ids; the default scope (all memberships) is uncapped and joined into the header.                                                                                              | A tenant with >50 memberships.                                                                                            | F4     |

---

## ✅ Closed — for reference

- **Auth0 DCR tenant workarounds** (domain-level connection, `allow_all` user policy) — both
  reverted 2026-07-31 and verified by full reconnect. The connector is now authorized by an explicit
  user-subject grant. _That grant must move with the application — see I3._
- **Stateless-vs-stateful connector** — decided 2026-08-01: stateless, scope carried per call, with
  self-describing responses replacing session stickiness.
- **MCP GraphQL documents unvalidated** (gap 8) — closed by graphql-codegen; `src/tools/*.ts` and
  `src/upstream/*.ts` are both in the `documents` list and codegen exits non-zero on a bad field.
- **`TaxCategory.isActive` missing resolver** (F1) — resolved by rebasing onto `main` (#4090).
- **Phase 0 RLS pre-flight** — PASS on production; `FORCE ROW LEVEL SECURITY` is the load-bearing
  setting. Still to re-check on dev → O2.
