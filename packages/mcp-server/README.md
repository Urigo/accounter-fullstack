# @accounter/mcp-server

Remote MCP (Model Context Protocol) server that exposes a curated, **read-only** subset of Accounter
capabilities to Claude clients (Claude.ai / Claude Desktop).

See the design docs:

- [`docs/spec.md`](./docs/spec.md) — connector specification
- [`docs/implementation-blueprint.md`](./docs/implementation-blueprint.md) — incremental
  implementation plan
- [`docs/operations-runbook.md`](./docs/operations-runbook.md) — incident handling, metrics, log
  queries, rollback
- [`docs/submission-checklist.md`](./docs/submission-checklist.md) — connector submission readiness

## Status

Phase 1 (read-only) is feature-complete. The server provides: strict startup env validation; an HTTP
transport with `/health`, `/metrics`, the OAuth protected-resource metadata endpoint, and the MCP
route (`POST /mcp`, JSON-RPC 2.0) with graceful shutdown; Auth0 bearer-token verification; identity
mapping to an internal user + business-membership context with memberships resolved from the
Accounter GraphQL server; a curated registry of fifteen read-only tools
(`accounter_list_business_memberships`, `accounter_explain_terminology`, `accounter_search_charges`,
`accounter_get_charges`, `accounter_get_transactions`, `accounter_get_documents`,
`accounter_get_ledger_records`, `accounter_list_clients`, `accounter_get_contracts`,
`accounter_list_security_holdings`, `accounter_get_security_executions`, `accounter_list_tags`,
`accounter_list_tax_categories`, `accounter_list_businesses`, `accounter_balance_report`) each gated
by strict input validation, a per-tool authorization policy, and business-scope narrowing forwarded
upstream as `x-business-scope`; a hardened upstream GraphQL client (timeout, bounded retries, header
propagation, sanitized errors); a unified error taxonomy; per-`tools/call` rate limiting; in-process
operational metrics (request/outcome counters, a latency histogram, auth-failure counters) exposed
at `GET /metrics`; and OpenTelemetry tracing exported to Grafana Tempo (opt-in), correlated with the
backend via `traceparent` and `X-Correlation-Id`.

Phase 2 (write scope) has landed its first two tools — `accounter_update_charges_tags` and
`accounter_upload_documents` — behind the `MCP_ENABLE_WRITE_TOOLS` flag, which is **off by
default**. See [Write tools](#write-tools) for the model, and
[Known limitations](#known-limitations) for what is still out of scope.

## Tools

`tools/call` for a registered tool runs input validation → authorization policy → handler. Every
failure is normalized through a single error taxonomy (`src/errors/taxonomy.ts`) and returned as a
tool result with `isError` and a `{ code, message, correlationId, retryable }` payload (plus
`issues` for validation and `retryAfterMs` for rate limiting). Machine codes (spec §10.2):
`VALIDATION_ERROR`, `AUTHENTICATION_ERROR`, `AUTHORIZATION_ERROR`, `UPSTREAM_ERROR`,
`TIMEOUT_ERROR`, `RATE_LIMIT_ERROR`, `INTERNAL_ERROR`. Unexpected errors map to a sanitized
`INTERNAL_ERROR` — stack traces and internal details are never leaked.

List-producing tools build their output through a shared formatter (`src/tools/output.ts`) that caps
the serialized payload (dropping whole trailing items — never invalid JSON), reports `returnedCount`
/ `totalCount` / `truncated`, and attaches a `continuation` hint whenever not all results were
returned (an upstream cap or the payload-size guard).

**Every payload is mirrored into `content`.** `shapeListResult`, `shapeWriteResult` and
`toToolErrorResult` all return the serialized payload as a `content` text block (after the summary
line) _as well as_ in `structuredContent` — the backwards-compatibility behavior MCP 2025-06-18 asks
of a server returning structured content. This is not optional polish: `structuredContent` is
contractually meaningful only when a tool advertises an `outputSchema`, none of these do, and a
client is free to ignore it. Relying on it alone once left every tool returning summary lines with
no rows behind them. `mirroring-contract.test.ts` enforces the rule across the whole registry, so a
new tool cannot opt out — and the byte cap still measures the payload the model actually reads,
since the mirrored text is the same string `fittingCount` binary-searches on.

Each `tools/call` is rate-limited (`src/rate-limit/`) with an in-memory fixed-window counter keyed
by **user + business scope + tool**, enforced before any upstream call. Exceeding the limit returns
a `RATE_LIMIT_ERROR` with `retryAfterMs`. Limits are configured via `MCP_RATE_LIMIT_CONFIG`
(`{"windowMs":60000,"max":60}` by default).

### Business scoping contract

Every business-scoped tool follows one convention, so the model learns it once:

- **Discover, then scope.** `accounter_list_business_memberships` returns
  `{ memberBusinessId, name, role }`. Pass those ids back as `memberBusinessIds` (or, for the
  balance report, the singular required `memberBusinessId`).
- **The name is the access axis, deliberately.** These are the businesses the caller is a _member
  of_; they become the upstream `byOwners` / `ownerIDs` owner predicate. They are not the charge
  filter `byBusinesses` or the documents filter `businessIds`, which are _counterparty_ predicates —
  a distinction that has already caused one scoping bug
  ([plan](../../docs/coherent-owner-scoping-for-mcp/plan.md)).
- **`memberBusinessIds` is optional and means "narrow".** Omitting it covers every business the
  caller belongs to. Any id outside the caller's memberships is **rejected**, never silently
  dropped.
- **The resolved scope is forwarded upstream** as `x-business-scope`, so RLS on the Accounter server
  is the actual enforcement point (see [Identity & tenant scope](#identity--tenant-scope)).
- **Every row is owner-tagged.** Charges, transactions, documents, balance rows, tags, tax
  categories and directory rows all carry `ownerId` (charges also carry `ownerName`), so a result
  spanning several memberships can be grouped, sorted, and attributed instead of silently merged.
  Nested rows count: the `transactions` and `documents` inside a charge are tagged too. Transactions
  get theirs from `Transaction.ownerId` on the GraphQL server (added for this — the type previously
  had no owner); documents inherit theirs from their charge; balance rows carry the single business
  the report ran for. `ownerId` is `null` only when there is genuinely nothing to attribute to (a
  document with no charge), which means "unknown", not "yours".
- **The response echoes `scope.memberBusinessIds`.** A widened scope is visible in the payload
  instead of being inferred, and the charges summary text names the business count when it is
  greater than one.

`accounter_list_business_memberships` is the one exception: it takes no parameters and echoes no
scope, because it _is_ the scope.

- **`accounter_list_business_memberships`** — list the businesses the caller is a member of, with
  their role in each. Sorted by name (fixed-locale, case-insensitive) then id, with unnamed
  businesses last. Pure: memberships are already on the auth context, so it makes no upstream call.
  A caller with no memberships gets an empty list, not an error. This is the scope-discovery entry
  point; to browse the full business directory use `accounter_list_businesses`.
- **`accounter_explain_terminology`** — the connector's **glossary**: what charges, transactions,
  documents, ledger records, businesses and tax categories actually mean in Accounter, including the
  distinctions that are not inferable from the schema (a charge is an aggregate, not a bank charge;
  `byOwners` is the owner predicate while `byBusinesses` is the counterparty one; `INTERNAL` and
  `CONVERSION` charges double-count in spend totals; ledger slot 2 is the VAT split; only _business_
  entities are required to balance). Called with no arguments it returns a one-line index of every
  term; `terms` looks up specific ones (matching canonical names, enum tokens, GraphQL type names
  and field names, case- and separator-insensitive, with a substring fallback) and `topics` returns
  a whole area in full. An unmatched term is reported under `unmatched` with suggestions rather than
  failing the call. Like discovery it is **pure** — static content, no upstream call, no
  `x-business-scope` — and unlike every other tool it needs **no business scope** at all
  (`requiresBusinessScope: false`, `dataClassification: 'public'`), so a caller with zero
  memberships can still read it. Content is pinned to the package's own enum constants by
  `terminology-contract.test.ts`, so a charge type added upstream fails the suite instead of quietly
  going undefined.
- **`accounter_search_charges`** — read-only charges search/browse within the caller's authorized
  businesses. Accepts optional `memberBusinessIds` (subset of memberships) plus **every
  `ChargeFilter` predicate upstream honors**, flat: `fromDate`/`toDate` (overlap — any
  document/transaction/ledger date in the window), `fromMainDate`/`toMainDate` (containment on the
  charge's main date), each bounded to `MAX_DATE_RANGE_DAYS`; `tags`, `freeText`, `flow`
  (`ALL`/`INCOME`/`EXPENSE`), `byChargeTypes`, `byBusinesses` (counterparty), `byBusinessTrips`,
  `accountantStatus`, `sortBy`, and the `without*`/`with*` document/transaction/ledger flags — with
  bounded pagination (`pageSize` ≤ `MAX_PAGE_SIZE`). Returns normalized charges — each carrying
  `ownerId`/`ownerName` — plus pagination metadata and the echoed `scope`. Scoping uses the
  `byOwners` predicate upstream (the owner), never `byBusinesses` (the counterparty).
  `flow`/`tags`/`fromDate`/`toDate` are the tool's historical names for
  `chargesType`/`byTags`/`fromAnyDate`/`toAnyDate`; see `SEARCH_CHARGES_FILTER_ALIASES`.
- **`accounter_get_charges`** — read-only charge **detail**, by id (`chargeIds`) or by `filters`
  (the same shared `ChargeFilter` shape as `accounter_search_charges`, nested), with `page` /
  `pageSize` over filtered results. Returns each charge with owner, counterparty, amounts (total,
  VAT, withholding), the full set of dates, tags, and `metadata` counts; linked `transactions` and
  `documents` are opt-in via `includeTransactions` / `includeDocuments`. This is the drill-down for
  `accounter_search_charges`. A charge whose `owner` falls outside the resolved scope is dropped as
  defense-in-depth on top of RLS.

  A **foreign-securities** charge additionally carries the security traded and the portfolio
  executions behind the cash movement, opt-in via `includeSecurities`. That charge type is the one
  place where what happened is not in the charge itself: the cash leg is a bank row, and the trade
  lives in a separate ingested feed. Each security reports the `securityBusinessId` that
  `accounter_list_security_holdings` and `accounter_get_security_executions` are addressed by, so
  the answer can be followed into the portfolio. Three states stay distinct: the field is **absent**
  for a charge that is not a securities one and for one fetched without the flag, an **empty array**
  means the transaction descriptions carried no key the ingested feed knows, and
  `referenceFound: false` on a present security means the reference scrape is stale for a key that
  _is_ traded. Nesting executions multiplies the payload, so pair it with explicit `chargeIds` or a
  small `pageSize`.

  Both charge tools build their filter from one definition (`tools/charge-filters.ts`), and
  `schema-contract.test.ts` checks that definition against `input ChargeFilter` in `schema.graphql`,
  so a field added upstream fails the suite instead of quietly becoming unreachable. Two fields —
  `businessTrip`, `unbalanced` — are deliberately **not** accepted: upstream takes them and never
  passes them to the SQL, and a filter that silently matches everything is worse than an absent one
  (`UNSUPPORTED_UPSTREAM_CHARGE_FILTER_FIELDS`).

- **`accounter_get_transactions`** — read-only bank/card **transactions**, owner-tagged, by id
  (`transactionIds`) or by `filters` (every `TransactionsFilters` field: ids, charge ids, owners,
  event/debit/any date ranges, counterparties, missing-counterparty/info flags, free text). Each row
  carries direction, amount, event/effective dates, source description, `isFee`, `chargeId`,
  counterparty, account, and `ownerId`. A transaction whose owner falls outside the resolved scope
  is dropped as defense-in-depth on top of RLS — possible only since `Transaction.ownerId` was added
  upstream.
- **`accounter_get_documents`** — read-only **documents** by id (`documentIds`) or by `filters`
  (every `DocumentsFilters` field: business/owner/charge ids, date range, type, unmatched,
  missing-counterparty/info flags, free text). Each row carries `documentType`, serial number, date,
  amount, VAT, creditor/debtor, `chargeId`, `file`/`image` links, and `ownerId` (inherited from the
  document's charge). A document whose owning charge falls outside the resolved scope is dropped as
  defense-in-depth on top of RLS.
- **`accounter_get_ledger_records`** — read-only **double-entry ledger records** search. Filters on
  the three date axes a record has (`fromInvoiceDate`/`toInvoiceDate`,
  `fromValueDate`/`toValueDate`, or `fromDate`/`toDate` matching either), on the financial entity in
  any of the four account slots (`financialEntityIds` plus an optional `financialEntityAccounts`
  subset of `DEBIT_ACCOUNT_1`, `DEBIT_ACCOUNT_2`, `CREDIT_ACCOUNT_1`, `CREDIT_ACCOUNT_2`), and on
  `chargeIds`. Each row reports its `ownerId` and `chargeId` alongside the four debit/credit entries
  (account, amount, local currency amount), so results spanning businesses or charges group without
  a second call. Date ranges are bounded (≤ 1096 days) and rows capped (≤ 500, default 200) with a
  `truncated` flag.
- **`accounter_list_clients`** — the **clients** you bill: the businesses carrying a `clients` row,
  with their contact emails, the client-level default document type, and the external-system ids
  configured for each (Green Invoice, Hive, Linear, Slack, Notion, Workflowy). Filters by
  `nameContains` and by `clientBusinessIds`; each row reports its `ownerId`. A client's `businessId`
  **is** its business id, so it is the same value `accounter_list_businesses` returns as `id` and
  the same value `accounter_get_contracts` takes as `clientIds` — this is the tool that resolves a
  client by name before asking about its contracts. Unconfigured integrations are omitted rather
  than returned as `null`, and `generatedDocumentType` is the client-level default only: what
  actually gets issued is the contract's own `documentType`. Rows capped (≤ 300, default 150).
- **`accounter_get_contracts`** — read-only **client billing contracts**. Filters by `clientIds`, by
  `contractIds`, and by `isActive`. The owning ("admin") business axis is the membership axis — a
  contract is always owned by a business you are a member of — so `memberBusinessIds` doubles as the
  owner filter and is forwarded as the upstream `filters.ownerIds`; there is no separate owner input
  to drift from it. Each row reports its `ownerId` plus the client, period, amount, billing cycle,
  document type, product/plan, and purchase orders.
- **`accounter_list_security_holdings`** — the **securities portfolio**: one row per security with
  units held, weighted average cost per unit bought, totals bought and sold, and the span of the
  ingested trade history. `includeClosed` also returns securities traded but no longer held;
  `search` matches name (either language), symbol, ISIN, exchange, currency and every source
  identifier — the same fields the `/securities` screen searches, so the two cannot drift. Upstream
  takes no search argument and a portfolio is tens to low hundreds of rows, so the filtering,
  ordering (by |quantity| descending, biggest live position first) and row cap all happen in the
  tool. Two things about the numbers are load-bearing: the position is **derived** by adding up
  scraped executions rather than read from a bank balance, and amounts are in each security's own
  trade currency and are never converted. The response therefore carries `byCurrency` subtotals —
  the only valid aggregation — plus a machine-readable `caveats` array, rather than leaving a model
  to add a shekel column to a dollar one. Quantities and average costs are never summed at all.
- **`accounter_get_security_executions`** — the **trade history** behind that portfolio: buys,
  sales, dividends, interest, redemptions, distributions and transfers, newest first, with dates,
  direction, quantity, unit price, net value, commission and Israeli tax. Narrow by security
  (`securityBusinessIds`, `isins` or `symbols` — three ways of naming one axis, so they union with
  each other), by trade date, and by `tradeTypes`/`transactionTypes`. Really paginated upstream
  (1-based `page` here, 0-based there) with `pagination` echoed. `includeCharges` additionally
  resolves the charge each trade's cash movement landed on, and **requires naming the securities**:
  the pairing is greedy and one-to-one over a security's whole history, so it cannot be computed
  from a page — see the note in `docs/connector-gaps-and-decisions.md`. Asking for it unnarrowed is
  refused here as a `VALIDATION_ERROR` rather than upstream as an `UPSTREAM_ERROR`, so the failure
  says what to add.
- **`accounter_list_tags`** — list tags for categorizing charges, optionally filtered by name and by
  `memberBusinessIds`. Rows carry `ownerId`. Deterministically sorted (name, then id) and
  size-capped (≤ 1000).
- **`accounter_list_tax_categories`** — list tax categories (id, name, `ownerId`, IRS code,
  bookkeeping sort code, active flag), optionally filtered by name, active status, or
  `memberBusinessIds`. Same deterministic sort + cap.
- **`accounter_list_businesses`** — list the full business directory (id, name, `ownerId`, active
  flag, `isClient`, and the matched `taxCategory` as `{ id, name }`, or `null` when the business has
  none mapped) — every business visible to the caller, not just their memberships — optionally
  filtered by name (forwarded to the upstream `allBusinesses(name:)` filter), active status, client
  status, or `memberBusinessIds`, and paginated with `limit` + 1-based `page` (forwarded as the
  upstream `limit`/`page` args; the response echoes `pagination`). Same deterministic sort + cap.
  Note that `activeOnly`/`nameContains` narrowing happens within the fetched page, so a page can
  come back short — `isClient` is the exception, forwarded to the upstream
  `allBusinesses(isClient:)` predicate so counts and paging describe the filtered directory. Use
  `accounter_list_business_memberships` instead for just the caller's own memberships and roles, and
  `accounter_list_clients` to enumerate clients with their emails and integrations rather than
  paging this directory for them.
- **`accounter_balance_report`** — read-only balance report (transactions) for **exactly one** of
  your businesses over a bounded date range (≤ 1096 days), selected by the required singular
  `memberBusinessId`. Requires `business_owner`/`accountant` role; rows are capped at 1000 with a
  `truncated` flag. Every row carries `ownerId` — the one business the report ran for, which the
  response also reports once alongside the echoed `scope`.

The two **write** tools below are only exposed when `MCP_ENABLE_WRITE_TOOLS=1`; see
[Write tools](#write-tools) for the rules they all share.

- **`accounter_update_charges_tags`** — add and/or remove tags across 1–50 charges. Tags are given
  by id (`addTagIds` / `removeTagIds`), never by name: names are not unique across owners, so
  resolving them here would mean guessing which of several same-named tags was meant — the model
  resolves them with `accounter_list_tags` first. Incremental, not a replacement, and removals run
  before additions so an id in both lists ends up added. Requires `business_owner`/`accountant`.
- **`accounter_upload_documents`** — attach 1–10 documents to an **existing** charge, given either
  as `documentUrls` (preferred — the server fetches them, so there is no size limit) or as inline
  base64 `documents`; exactly one of the two per call. `chargeId` is required (upstream would
  otherwise create a new charge) and `isSensitive` is pinned to `false`. Each inline file is
  validated for encoding, MIME type, and size _before_ anything is uploaded. Upstream returns one
  result per input, so partial failure is reported positionally rather than collapsed. See
  [Uploading by URL](#uploading-by-url) and
  [Why inline upload is small](#why-inline-upload-is-small). Requires `business_owner`/`accountant`.

## Upstream GraphQL client

Tool handlers talk to the Accounter GraphQL server through a single hardened client
(`src/upstream/graphql-client.ts`): a strict per-request **timeout** with cancellation, **bounded
retries** for idempotent read failures only (network errors, timeouts, and 5xx — never 4xx
auth/validation errors, GraphQL-level errors, or **any write**), **header propagation** of the
correlation id, the caller's `Authorization` bearer token, and the resolved read scope as
`x-business-scope`, and **sanitized** upstream errors (no stack traces or internal details). Phase 1
is read-only: mutations/subscriptions are refused, and there is **no** generic "execute anything"
surface — tools use typed read-only wrappers via `createReadOperation`.

## Identity & tenant scope

A verified token is mapped to an `McpAuthContext` — `userId`, `roles` (token scopes), business
`memberships`, and a `defaultReadScope` (every business the user belongs to). Memberships are
resolved from the Accounter GraphQL server by forwarding the caller's bearer token to a dedicated
`myMemberships` query (`src/upstream/memberships.ts`) — never derived from token claims — so tenant
membership is always authoritative from the server's database. The membership source is a pluggable
seam (`MembershipSource`) for testing. Requested scope narrowing is validated against the user's
memberships: any business id outside them is rejected rather than silently dropped. These shapes and
rules mirror the server package's tenant-isolation model
(`packages/server/src/shared/helpers/auth-scope.ts`).

**RLS upstream is the enforcement point.** The resolved read scope is forwarded on every tool call
as the `x-business-scope` header, which the Accounter server turns into `app.current_business_scope`
and applies through row-level security. MCP-side narrowing is the _first_ gate, not the only one: it
rejects out-of-scope ids early with a legible `AUTHORIZATION_ERROR`, but the database is what
actually constrains the rows. This matters for the argument-less upstream queries (`allTags`,
`taxCategories`), which have no filter arguments to narrow — the header is the only mechanism
available to them.

The context is built once in `execute.ts`, where the resolved scope is known, and handlers receive
it as `context.upstream`. A handler therefore cannot forget to forward the scope; a registry-wide
test asserts every registered tool sends the header.

Two deliberate exceptions:

- **The membership bootstrap is never scoped.** `myMemberships` is the query that _discovers_ the
  scope, so scoping it would be circular, and a stale or unknown id would fail the whole request at
  authentication time rather than returning an empty list.
- **An empty scope sends no header at all.** Upstream reads an absent `x-business-scope` as "all of
  the caller's memberships", so emitting an empty header would widen the scope rather than narrow it
  — the exact opposite of the intent.

## OAuth discovery

`GET /.well-known/oauth-protected-resource` serves an
[RFC 9728](https://www.rfc-editor.org/rfc/rfc9728) protected-resource metadata document so Claude
clients can discover the authorization server:

```json
{
  "resource": "<MCP_PUBLIC_BASE_URL>",
  "authorization_servers": ["<AUTH0_ISSUER_URL>"],
  "bearer_methods_supported": ["header"]
}
```

The document is fully config-driven (no hardcoded URLs). `bearer_methods_supported: ["header"]`
signals that tokens are accepted only via the `Authorization` header, never query params.

## Observability

Every request is assigned a `requestId` and a `correlationId` (the latter inherited from an inbound
`X-Correlation-Id` header when present, otherwise generated). The correlation id is echoed back on
the response and propagated upstream via the `X-Correlation-Id` header on every GraphQL call.
Structured JSON logs are emitted at request start and completion, carrying `requestId`,
`correlationId`, `method`, `route`, and — on completion — `status` and `latencyMs`. Completion logs
also carry `responseCompleted`/`aborted` (a client that hung up mid-response) and `uptimeSeconds`,
and `request started` carries `msSinceLastRequest` (idle gap; absent on a process's first request) —
so idle spin-downs, cold starts, and client-side disconnects are visible from the logs. Secrets and
authorization headers are never logged.

### Metrics

An in-memory metrics registry (`src/observability/metrics.ts`) records operational telemetry per
process (labels never carry PII — only tool names, outcome classes, and error categories):

- **`requestsTotal`** — request counter keyed by `"<tool>|<outcome>"`, where outcome is `success` or
  one of the taxonomy-derived error classes (`validation_error`, `authentication_error`,
  `authorization_error`, `rate_limited`, `upstream_error`, `timeout_error`, `internal_error`).
- **`latencyMs`** — a latency histogram with per-bucket (non-cumulative) counts in ms plus an `+Inf`
  overflow bucket, alongside running `count`/`sum` totals.
- **`authFailuresTotal`** — auth failure counter keyed by reason (`missing_token`, `expired_token`,
  `invalid_token`). `expired_token` (a live token that aged out) is metered separately from
  `invalid_token` (bad signature/issuer/audience) so "clients should refresh" is distinguishable
  from "tokens are misconfigured/abused".
- **`upstreamErrorsTotal`** — upstream failure counter keyed by category.
- **`rateLimitedTotal`** — total rate-limited requests.
- **`labeledTotals`** — tool-contributed usage counters, keyed by counter name then label (see
  [Usage logging](#usage-logging)). Distinct labels per counter are capped, with new labels beyond
  the cap folded into `__other__`, because some labels derive from caller input.

A snapshot is exposed at `GET /metrics`:

```bash
curl http://localhost:3100/metrics
```

### Handshake logging

Every `initialize` emits one structured line tagged `event: "mcp_initialize"`, carrying
`clientName`, `clientVersion`, `requestedProtocolVersion`, `servedProtocolVersion`,
`protocolVersionMismatch`, `clientCapabilities` (names only) and the usual `userId` /
`correlationId`.

This exists because a client's handling of tool results changed underneath this connector once and
the server had no record of it — the change had to be reconstructed from the _client's_ own logs.
`clientInfo` is what dates such a change, and `protocolVersionMismatch` is the one field worth
alerting on.

The line is emitted from `dispatchMcpRequest`, not from the `case 'initialize'` that builds the
response: `handleRpcRequest` is the pure, env-free half and receives neither the caller nor the
correlation id. `describeInitializeParams` does the parsing and is deliberately total — `params` is
`unknown` off the wire, so a malformed handshake still produces a line rather than an exception. A
client sending something the server cannot parse is precisely the event worth seeing. Caller-derived
fields are merged _beneath_ the canonical ones, so a client cannot attribute its call to another
user by putting `userId` in `clientInfo`, and `clientInfo` strings are clipped before they reach the
log.

### Modern-era probe detection

The connector implements a handshake-based protocol revision. The current revision removed
`initialize` entirely, so a client that moved there completely would stop handshaking — and
`mcp_initialize` would go _quiet_ rather than change, leaving failing calls as the first symptom.

A dual-era client tries a modern request first and falls back on the response, so that attempt is
the available warning. Any request carrying `MCP-Protocol-Version` that disagrees with what we
serve, a per-request `_meta` protocol version, or the modern-only `server/discover` method emits one
`event: "mcp_modern_probe"` line at `warn`. Silence is the normal state; a line means a client is
moving.

It is **observation only, and that is load-bearing**: era detection keys off what a server returns,
so answering `server/discover` — or anything else that makes us look modern — would stop the
fallback currently keeping every client working. A test asserts responses are byte-identical whether
or not a probe was detected.

### Usage logging

Operational telemetry answers "is it healthy"; usage telemetry answers "what are callers trying to
do". Every completed tool call emits exactly one structured log line tagged `event: "tool_call"` —
including calls rejected by validation, policy, or the rate limiter — carrying `tool`, `outcome`,
`latencyMs`, `userId`, `correlationId`, `businessScopeSize`, and result-size fields. The
request-level logs cannot carry this: every MCP call is the same `POST /mcp`.

A tool can enrich its own line through the optional `observe` hook on its `ToolDefinition`
(`src/tools/registry.ts`). The hook is pure, guarded against throwing, and deliberately separate
from `ToolResult` — `tools/call` returns the result object verbatim as the JSON-RPC payload, so
anything attached there would be sent to the caller. Tool-supplied fields are merged _beneath_ the
canonical ones, so a tool cannot misreport its own name, outcome, or caller.

`accounter_explain_terminology` uses it to record what callers ask the glossary — `requestedTerms`
(verbatim), `matchedTerms` (canonical), `missedTerms`, `requestedTopics` and `glossaryMode` — plus
the `glossary_term_requests`, `glossary_term_misses` and `glossary_mode` label counters. What a
caller looks up is the clearest available read on the vocabulary they arrived with, and
`missedTerms` is a self-maintaining backlog of glossary entries to write.

The write tools use it too. A write result has none of the shared list-shape fields, so without a
hook its usage line would record _that_ a write happened and nothing about what it did:
`accounter_upload_documents` reports `documentSource` (`urls` vs `inline`),
`requestedDocumentCount`, `uploadedCount` and `failedCount` plus a `document_upload_source` counter,
and `accounter_update_charges_tags` reports `requestedChargeCount`, `updatedChargeCount`,
`addedTagCount` and `removedTagCount` — the gap between requested and updated is how a model working
from stale charge ids becomes visible. This line is the complement to the `audit: true` line each
write already emits _before_ its handler runs: the audit line names the records, this one says what
applied. Neither carries document content, filenames, or URLs.

See [`docs/operations-runbook.md`](./docs/operations-runbook.md) §3.1 (handshake), §3.2 (modern-era
probes) and §3.3 (tool calls) for the full field references and the `jq` extraction recipes (client
versions, most-requested terms, missing terms, tool popularity).

### Tracing (OpenTelemetry → Grafana Tempo)

The MCP server emits OpenTelemetry traces over OTLP/HTTP to the same Grafana Tempo backend as the
main Accounter server, using the same `OTEL_*` configuration conventions (see
[Configuration](#configuration)). Tracing is **off by default** and enabled with `OTEL_ENABLED=1`
plus an `OTEL_EXPORTER_OTLP_ENDPOINT`.

Spans come from two sources:

- **Auto-instrumentation** (`@opentelemetry/auto-instrumentations-node`): the incoming `POST /mcp`
  HTTP server span, and the outbound `fetch` client spans for upstream GraphQL calls (via the
  `undici` instrumentation).
- **Manual spans** (`src/observability/tracing.ts`, `withSpan`): token verification (`auth:verify`),
  tool execution (`tool:<name>`), and each upstream GraphQL call (`upstream:graphql`). Each carries
  the business-level `accounter.correlation_id` attribute. The `withSpan` signature is unchanged, so
  call sites did not move — and when OTEL is disabled it resolves to the API's no-op tracer at
  effectively zero cost.

The SDK is started from a `--import` preload (`src/bootstrap-telemetry.ts`) so instrumentation
patches `node:http`/`fetch` before the app loads, and flushed on graceful shutdown.

#### Linking MCP traces to the backend

Two mechanisms tie an MCP request to the backend work it triggers:

1. **W3C `traceparent` propagation (the distributed-trace join).** The upstream `fetch` is
   auto-instrumented, so `traceparent` is injected on every upstream GraphQL call and the Accounter
   server's HTTP instrumentation continues the **same trace**. A single Grafana trace therefore
   spans `POST /mcp` → `tool:<name>` → `upstream:graphql` → the backend HTTP/GraphQL/Postgres spans.
2. **`X-Correlation-Id` as a shared, searchable attribute.** The correlation id (inherited from the
   inbound header or generated) is set as `accounter.correlation_id` on the MCP spans and forwarded
   upstream as `X-Correlation-Id`; the backend records the same attribute on its spans (via its
   `correlationIdPlugin`). This lets you pivot from an MCP log line to the backend trace and search
   Tempo by the business-level id.

## Running locally

```bash
# with required env vars set (see Configuration below):
yarn workspace @accounter/mcp-server dev
curl http://localhost:3100/health
# → {"status":"ok","service":"@accounter/mcp-server","version":"…","uptimeSeconds":…}
```

The server handles `SIGINT`/`SIGTERM` by closing connections and exiting cleanly (forcing exit after
a grace period).

To connect this server to Claude Desktop as a custom connector — HTTPS tunnel, Auth0 application,
connector fields, and a troubleshooting table — see
[`docs/local-development.md`](./docs/local-development.md). Note that Claude requires an HTTPS
connector URL, so `http://localhost:3100` cannot be used directly.

### MCP endpoint

The transport lives at `POST /mcp` and accepts JSON-RPC 2.0. Requests **must** carry a valid Auth0
bearer token in the `Authorization` header. The token is verified (signature via the tenant JWKS,
plus `issuer`, `audience`, and expiry). A request with no token gets a `401` pointing at the
protected-resource metadata document; a request with an invalid/expired token gets a `401` with
`error="invalid_token"`. Supported methods: `initialize`, `ping`, `tools/list`, and `tools/call`
(the curated tools; the internal `accounter_smoke_ping` tool is still dispatchable by name but is no
longer advertised by `tools/list`). Unknown methods return a deterministic JSON-RPC `-32601` error;
notifications receive `202 Accepted` with no body.

```bash
curl -sX POST http://localhost:3100/mcp -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Configuration

Environment variables are validated at startup with a strict schema
([`src/config/env.ts`](src/config/env.ts)). Missing required variables or malformed values cause the
process to exit immediately with a clear error. Secrets are supplied via the environment only.

| Variable                           | Required | Default                  | Description                                                        |
| ---------------------------------- | -------- | ------------------------ | ------------------------------------------------------------------ |
| `MCP_PUBLIC_BASE_URL`              | yes      | —                        | Public HTTPS origin of this MCP server (used in OAuth metadata)    |
| `AUTH0_ISSUER_URL`                 | yes      | —                        | Auth0 issuer/tenant URL used to validate access tokens             |
| `AUTH0_AUDIENCE`                   | yes      | —                        | Expected `aud` claim for incoming access tokens                    |
| `GRAPHQL_UPSTREAM_URL`             | yes      | —                        | Base URL of the Accounter GraphQL server the tools call            |
| `MCP_SERVER_PORT`                  | no       | `3100`                   | TCP port the HTTP transport listens on                             |
| `MCP_ENABLED`                      | no       | `1`                      | Master kill-switch (`1` on / `0` off)                              |
| `MCP_TOOL_ALLOWLIST`               | no       | `''` (none)              | Comma-separated tool names allowed (empty = least privilege)       |
| `MCP_ENABLE_WRITE_TOOLS`           | no       | `0`                      | Expose mutating (write) tools (`1` on / `0` off)                   |
| `AUTH0_JWKS_URL`                   | no       | derived from issuer      | JWKS endpoint; defaults to `<issuer>/.well-known/jwks.json`        |
| `GRAPHQL_UPSTREAM_TIMEOUT_MS`      | no       | `10000`                  | Upstream GraphQL request timeout budget (ms)                       |
| `GRAPHQL_UPSTREAM_LONG_TIMEOUT_MS` | no       | `300000`                 | Budget for long-running calls (document ingestion: fetch + OCR)    |
| `MCP_RATE_LIMIT_CONFIG`            | no       | `''` (defaults)          | Optional rate-limit override spec (parsed by the limiter later)    |
| `OTEL_ENABLED`                     | no       | `0`                      | Enable OpenTelemetry tracing (`1` on / `0` off)                    |
| `OTEL_SERVICE_NAME`                | no       | `accounter-mcp-server`   | `service.name` resource attribute                                  |
| `OTEL_SERVICE_NAMESPACE`           | no       | `accounter`              | `service.namespace` resource attribute                             |
| `OTEL_DEPLOYMENT_ENV`              | no       | `NODE_ENV`/`development` | `deployment.environment.name` resource attribute                   |
| `OTEL_EXPORTER_OTLP_ENDPOINT`      | if OTEL  | —                        | OTLP/HTTP traces endpoint (e.g. `http://localhost:4318/v1/traces`) |
| `OTEL_EXPORTER_OTLP_HEADERS`       | no       | —                        | OTLP exporter headers as `key=value,key=value`                     |
| `OTEL_TRACES_SAMPLER`              | no       | `always_on`              | Sampler strategy (`always_on`, `parentbased_traceidratio`, …)      |
| `OTEL_TRACES_SAMPLER_ARG`          | if ratio | —                        | Ratio `0`–`1` for the ratio-based samplers                         |
| `OTEL_STARTUP_STRICT`              | no       | —                        | `true` ⇒ abort the process on a telemetry startup failure          |

## Scripts

```bash
yarn workspace @accounter/mcp-server build     # tsc → dist/
yarn workspace @accounter/mcp-server dev       # run entrypoint with tsx (watch)
yarn workspace @accounter/mcp-server lint      # eslint
yarn workspace @accounter/mcp-server test      # vitest (package-scoped)
yarn workspace @accounter/mcp-server typecheck # tsc --noEmit
yarn workspace @accounter/mcp-server benchmark # perf/timeout suite → bench/summary.md
```

## Smoke test

With the four required env vars set and the server running
(`yarn workspace @accounter/mcp-server dev`):

```bash
# 1. Health (no auth) → 200 {"status":"ok",...}
curl -s http://localhost:3100/health

# 2. OAuth discovery (no auth) → resource + authorization_servers
curl -s http://localhost:3100/.well-known/oauth-protected-resource

# 3. Unauthenticated MCP call → 401 with a WWW-Authenticate resource_metadata pointer
curl -si -X POST http://localhost:3100/mcp -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | grep -i -E 'HTTP/|www-authenticate'

# 4. Authenticated tool list → the curated tools, accounter_list_business_memberships first
#    (accounter_smoke_ping is dispatchable but intentionally not listed)
TOKEN=<a valid Auth0 access token for AUTH0_AUDIENCE>
curl -s -X POST http://localhost:3100/mcp -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# 5. Discover the businesses you can read → [{ memberBusinessId, name, role }]
curl -s -X POST http://localhost:3100/mcp -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"accounter_list_business_memberships","arguments":{}}}'

# 6. Authenticated tool call, scoped to one of those ids.
#    The response echoes scope.memberBusinessIds and every row carries ownerId.
curl -s -X POST http://localhost:3100/mcp -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"accounter_list_tags","arguments":{"memberBusinessIds":["<memberBusinessId from step 5>"]}}}'

# 7. Negative check: an id outside your memberships must be REJECTED, not ignored.
#    Expect isError: true and code AUTHORIZATION_ERROR.
curl -s -X POST http://localhost:3100/mcp -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"accounter_list_tags","arguments":{"memberBusinessIds":["00000000-0000-4000-8000-000000000000"]}}}'

# 8. Securities: the portfolio, then the trades behind one row.
#    Expect byCurrency subtotals and a caveats array, and a securityBusinessId to
#    carry into step 9.
curl -s -X POST http://localhost:3100/mcp -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"accounter_list_security_holdings","arguments":{}}}'

# 9. Executions for one security, newest first, with charge links.
#    Run it twice with pageSize 5 and 100: the same execution must report the same
#    chargeId either way — that invariant is why includeCharges needs the securities named.
curl -s -X POST http://localhost:3100/mcp -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"accounter_get_security_executions","arguments":{"securityBusinessIds":["<securityBusinessId from step 8>"],"includeCharges":true,"pageSize":5}}}'

# 10. Clients, then the contracts behind one. Expect integrations to carry only
#     the keys actually configured, and no Green Invoice API call in the server log.
curl -s -X POST http://localhost:3100/mcp -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"accounter_list_clients","arguments":{}}}'

# 11. The businessId from step 10 is already a clientIds value — no translation.
curl -s -X POST http://localhost:3100/mcp -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"accounter_get_contracts","arguments":{"clientIds":["<businessId from step 10>"]}}}'

# 12. The same clients, seen from the directory: every row carries isClient, and
#     the filter is applied upstream so totalCount describes the filtered set.
curl -s -X POST http://localhost:3100/mcp -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"accounter_list_businesses","arguments":{"isClient":true}}}'
```

The automated equivalent of steps 1–12 (with the Auth0 verifier and upstream mocked) lives in
`src/__tests__/mcp-e2e.test.ts` and runs with `yarn workspace @accounter/mcp-server test`.

## Troubleshooting

| Symptom                                                                         | Likely cause / fix                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Process exits at startup with `[env] Invalid environment …`                     | A required env var is missing/malformed. The printed report lists each offending key; fix and restart. Required: `MCP_PUBLIC_BASE_URL`, `AUTH0_ISSUER_URL`, `AUTH0_AUDIENCE`, `GRAPHQL_UPSTREAM_URL`.                                                                                                                                                         |
| `POST /mcp` returns `401` with no `error`                                       | No bearer token. The `WWW-Authenticate` header points at the metadata document.                                                                                                                                                                                                                                                                               |
| `POST /mcp` returns `401` with `error="invalid_token"`                          | Token failed verification (signature/JWKS, `iss`, `aud`, or expiry). Confirm the token's audience matches `AUTH0_AUDIENCE` and the issuer matches `AUTH0_ISSUER_URL`.                                                                                                                                                                                         |
| `/mcp` and `/.well-known/...` return `404` (`/health` + `/metrics` still `200`) | The kill-switch is on (`MCP_ENABLED=0`) — only the MCP transport and its OAuth metadata route are disabled; `/health` and `/metrics` stay up. Set `MCP_ENABLED=1`.                                                                                                                                                                                            |
| Tool result `isError: true`, code `UPSTREAM_ERROR`/`TIMEOUT_ERROR`              | The Accounter GraphQL server was unreachable/slow. Check `GRAPHQL_UPSTREAM_URL` and `GRAPHQL_UPSTREAM_TIMEOUT_MS` (uploads use `GRAPHQL_UPSTREAM_LONG_TIMEOUT_MS`); read timeouts are retried (bounded), 4xx/GraphQL errors are not, and a timed-out **write** is reported non-retryable — it may still be in progress upstream, so verify before re-sending. |
| Tool result code `AUTHORIZATION_ERROR`                                          | The caller lacks a required role, requested a business outside their memberships, or has no memberships. Verify the token's scopes and the server-side `business_users` rows.                                                                                                                                                                                 |
| Tool result code `RATE_LIMIT_ERROR` with `retryAfterMs`                         | Per-`{user, scope, tool}` window exceeded. Back off for `retryAfterMs`, or tune `MCP_RATE_LIMIT_CONFIG`.                                                                                                                                                                                                                                                      |

## Write tools

Two mutating tools are available, and both are **hidden unless `MCP_ENABLE_WRITE_TOOLS=1`**:

| Tool                            | What it does                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `accounter_update_charges_tags` | Adds and/or removes tags across one or more charges (tag **ids**, not names) |
| `accounter_upload_documents`    | Attaches documents — by URL or inline base64 — to an **existing** charge     |

The default is off so that upgrading a running deployment never silently grants the model write
access — an operator opts in per environment. `MCP_TOOL_ALLOWLIST` composes on top and can narrow
which write tools are exposed, but naming one in the allowlist can never turn writes on. A tool
excluded by either control is reported as `Unknown tool`, exactly like a nonexistent one, so neither
control announces the capability it is hiding.

Four properties hold for every mutating tool, enforced centrally rather than per tool:

- **A separate, guarded client path.** `UpstreamGraphQLClient.query()` still refuses anything that
  is not a read; `mutate()` / `mutateMultipart()` refuse anything that is not a _single_ top-level
  mutation. Neither can send the other's traffic.
- **No retries.** A mutation is not idempotent, so a timed-out or failed write surfaces to the
  caller rather than being re-sent and possibly double-applied.
- **A single write target.** A read may span every membership; a write must resolve to exactly one
  business. An ambiguous scope is refused with an actionable message (pass `memberBusinessId`)
  rather than resolved by picking one.
- **An audit line per call**, emitted _before_ the handler runs, carrying the tool, user,
  correlation id, write-target business, and affected id counts — never file contents, filenames, or
  tokens.

Two tool-specific rules worth knowing:

- `accounter_upload_documents` requires `chargeId`. The upstream mutation _creates a new charge_
  when it is omitted, which is not a side effect the model should trigger by leaving a field blank.
  `isSensitive` is pinned to `false` and is deliberately absent from the input schema — the upstream
  name is misleading, since `getOcrData` returns early with `documentType: UNPROCESSED` whenever it
  is set, so `true` does not so much mark a document sensitive as skip OCR entirely and land it with
  no amount, date, counterparty, or serial.
- `accounter_update_charges_tags` is incremental, not a replacement: tags not named in
  `removeTagIds` stay. Removals are applied before additions, so a tag id passed in _both_ lists
  ends up added.

### Uploading by URL

`documentUrls` is the path to reach for. The **server** fetches each URL and ingests the result, so
the bytes never pass through the model — which is what every limit in the next section is working
around. There is no size cap on this branch. Google Drive share links work (they are resolved
through the Drive API, because `/file/d/<id>/view` returns an HTML page rather than the file), as
does any direct download link.

A server that fetches caller-supplied URLs is an SSRF primitive, so
`packages/server/src/modules/documents/helpers/fetch-remote-document.helper.ts` guards it: private,
loopback, link-local (the cloud metadata address included) and CGNAT ranges are refused,
`localhost`/`.local` are refused by name, non-`http(s)` schemes are refused, and redirects are
followed **manually** so every hop is re-validated — checking only the submitted URL is how this
guard is usually bypassed, since the redirect target is attacker-controlled too. Bytes, redirects,
and wall-clock time are capped, and the content type is read from the _response_, never from the
URL's extension: a `.pdf` link that answers with `text/html` is a login page, and storing it would
file a web page as a financial record.

The audit line records `documentUrlsCount` only, never the URLs themselves — a signed download link
carries an access token.

### Why inline upload is small

`accounter_upload_documents` caps a document at **256KB** and a call at **512KB**, decoded. That is
far below what the upstream mutation could take, and the reason is the transport, not the backend.

Inline base64 makes the _model_ the transport: it has to emit the entire encoded file as tool
arguments. Base64 tokenizes at roughly 3 characters per token, so a 277KB PDF costs on the order of
100k output tokens — past a single message's budget. Three ceilings apply, and the model's is the
tightest:

| Ceiling                                           | Effective limit                              |
| ------------------------------------------------- | -------------------------------------------- |
| Model's per-message output budget                 | a few tens of KB of file                     |
| `MAX_MCP_BODY_BYTES` (1MB JSON-RPC body)          | ~700KB decoded, after base64's 4/3 expansion |
| `MAX_DOCUMENT_BYTES` / `MAX_TOTAL_DOCUMENT_BYTES` | 256KB / 512KB                                |

An earlier revision advertised 5MB per file, which the body cap made unreachable — the request died
as a 413 before the tool's own check ran. `tools/__tests__/upload-limits.test.ts` now asserts the
caps against `MAX_MCP_BODY_BYTES` so the two cannot drift apart again.

Over-size errors deliberately name the alternative rather than just reporting a number. Without
that, the model's natural move is to downscale or re-encode the file until it fits — which for a
scanned receipt means archiving a degraded copy of a legal financial record. The alternative is
`documentUrls`: put the file somewhere fetchable and pass the link, and none of these ceilings
apply.

## Known limitations

- There is no generic "run any query" surface: every capability is a curated tool with a strict
  input schema, and the upstream client's read and write paths are separately guarded.
- Responses are **bounded** (date ranges ≤ 1096 days, page sizes ≤ 500, list caps of 200–1000
  depending on the tool, a 60KB payload-size guard — every cap is an exported `MAX_*` constant so
  the suite asserts it rather than this file being the record) — very large result sets are
  truncated with a `truncated`/`continuation` hint rather than streamed in full. Inline uploads are
  bounded too: ≤ 10 documents, 256KB per file and 512KB per call once decoded, against a MIME
  allowlist. Inline base64 is only viable for small files at all — see
  [Why inline upload is small](#why-inline-upload-is-small).
- Rate limiting and metrics are **in-process** (per replica); there is no shared/Redis-backed
  limiter or Prometheus exposition yet (the limiter and metrics are behind swappable seams).
- Tracing is exported to OpenTelemetry/Grafana Tempo (opt-in via `OTEL_ENABLED=1`), but metrics
  remain in-process (`GET /metrics`) and are not yet exported over OTLP.
- Writes carry **no idempotency key**, so a client that retries a call it never saw the result of
  can duplicate an upload. The tools themselves never retry (see above), and tag updates are
  naturally idempotent, but document uploads are not.
- The server's **accountant-approval degradation** runs upstream inside `batchUploadDocuments`; the
  connector does not model it, so it is not reflected in the tool's response.
