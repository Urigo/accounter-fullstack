# MCP Connector — Open TODO

Everything still outstanding for `@accounter/mcp-server`, consolidated from
[`connector-gaps-and-decisions.md`](./connector-gaps-and-decisions.md) and
[`owner-scoping-review.md`](./owner-scoping-review.md) so there is one list to work from. Those two
documents remain the source of detail — each item below links back to its section rather than
restating the analysis.

Last consolidated 2026-08-03, after I1/I2/I4 (#4103–#4105) merged into `main`. The preceding
owner-scoping work (#4089–#4097) is also in.

**Status of the connector today:** working end-to-end against Claude Desktop with a pre-registered
Auth0 client, read-only, fifteen curated tools, business scope enforced by RLS upstream. Not
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
| D4  | **Production hosting** — stable domain + TLS for the MCP origin. `MCP_PUBLIC_BASE_URL` must match it exactly.                                                                                                 | I5, leaving dev tunnels         | gap 4                  |
| D5  | **Third-party posture** — if a published connector is the goal, the reverted Auth0 tenant changes become permanent production requirements, not debugging artifacts.                                          | D1, D2, production tenant setup | tenant-changes section |

D3 (`MCP_TOOL_ALLOWLIST`) and D6 (rate-limit keying) are settled — see the closed list.

---

## I — Implementation gaps

Ranked by when they start to hurt, not by size.

### I6. Server-side gaps behind the connector-UX work — **high**

Raised by the agent-session feedback (`accounter_mcp_feedback.md`) and scoped out of the MCP-only
Phases 1–2 (`docs/mcp-extension/plan.md`). These need `packages/server` / `packages/migrations`
changes.

- [ ] **`transactions.current_balance` is a placeholder for most sources — the blocker for
      `balanceAfter`.** `resolvers/common.ts:57` passes the column straight through, but only the
      Poalim ILS/foreign and Discount triggers write a real value; the SWIFT, deposit, and all four
      credit-card triggers insert a literal `0`. Since `Transaction.balance` is non-null, a
      placeholder is indistinguishable from a genuine zero balance, and `Transaction` exposes no
      `sourceOrigin` for the MCP layer to filter on — so per-transaction balances and
      `accounter_list_accounts`' `includeCurrentBalance` both stay unshipped. Fix: write `NULL`
      instead of `0`, make the GraphQL field nullable, return `null` from the resolver, and backfill
      keyed off `source_origin` / account type (**not** off the value — a real `0` is legitimate).
      Longer term, capture the balance the card and deposit sources do expose.
- [ ] **No sorting or pagination on `transactionsByFilters`.** `TransactionsFilters` has no `sortBy`
      and the query returns an unbounded `[Transaction!]!`, which is why the feedback session
      hand-rolled cursor pagination over ~100 calls. Wants `sortBy` + `limit`/`offset` (or a cursor)
      and, ideally, a bulk export for the "fetch once, work locally" pattern.
- [ ] **`Charge.totalAmount` reported `null` on every income charge**, which is why revenue had to
      be computed from documents. Verify against `packages/server/src/modules/charges`; compute
      server-side if it is derivable.
- [ ] **`myMemberships.businessName` is nullable** and came back `null`, so the agent could not tell
      which business was which without fetching a charge. Fix the resolver's join, or fall back
      through `businesses(ids:)` in `src/upstream/memberships.ts`.
- [ ] **Not yet exposed, and asked for:** document → payment status (open/partially paid/paid with
      matched transaction ids) for invoiced-vs-collected, securities positions (holdings, cost
      basis, market value, realized/unrealized P&L), and a payroll breakdown. `allDeposits` already
      exists — a thin wrapper is cheap if deposits become a priority.

Source: `accounter_mcp_feedback.md` §§1–3, 6–7.

### I5. Stable tunnel for local development — **low (friction)**

Production is settled (see the closed list — `https://mcp.accounter.tax`). Local development still
uses `cloudflared` quick tunnels, which get a new hostname on every restart, silently invalidating
both `MCP_PUBLIC_BASE_URL` and the connector URL. It rotated twice in one session.

- [ ] Set up a named tunnel (or equivalent) for ongoing local development

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

Item ids (I1…I5, D1…D6) are kept stable even where the numbering now has gaps, because the other
docs and PR descriptions reference them.

- **I1 / D3 — `MCP_TOOL_ALLOWLIST` enforcement** — done in #4104. `isToolAllowed`
  (`src/tools/allowlist.ts`) is applied at the transport boundary: `tools/list` filters advertised
  descriptors and `tools/call` rejects an excluded tool as `Unknown tool`, so the allowlist never
  reveals which tools exist. **Semantics: an empty allowlist means no restriction**, a non-empty one
  permits only its members — so there is no "default allowlist" to keep `accounter_list_businesses`
  in, but any operator who sets one should include it or lose business discovery.
- **I2 / D6 — rate-limit keying** — done in #4105. `rateLimitKey` is now `userId|toolName`; scope
  was dropped from the key entirely, so subsets no longer fragment the quota. Isolation stays with
  RLS via `x-business-scope`.
- **I4 — `POST /mcp/` returned 404** — done in #4103. `normalizeRoutePath` strips a trailing slash
  for route lookup only; `/mcp/` now reaches the same handler, auth layer, and metrics, while
  `context.route` keeps the raw pathname.
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
