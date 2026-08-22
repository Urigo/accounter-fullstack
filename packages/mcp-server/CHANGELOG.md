# @accounter/mcp-server

## 0.1.0

### Minor Changes

- [#4165](https://github.com/Urigo/accounter-fullstack/pull/4165)
  [`0af7271`](https://github.com/Urigo/accounter-fullstack/commit/0af7271b93affd33a48dfdaada9b41b7ee71a91b)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Add filterable ledger-record and contract
  queries, and expose them as dedicated MCP tools.

  Server:

  - `ledgerRecordsByFilters(filters: LedgerRecordsFilters)` filters ledger records by invoice date,
    value date or either, by the financial entity in any of the four debit/credit account slots, by
    owner and by charge.
  - `LedgerRecord` now exposes `ownerId` and `chargeId`.
  - `contractsByFilters(filters: ContractsFilters)` filters contracts by owning (admin) business,
    client, contract id and active state.
  - `Contract` now exposes `ownerId` (matching the platform-wide row-owner field name).

  MCP server: new read-only `accounter_get_ledger_records` and `accounter_get_contracts` tools built
  on those queries, following the existing business-scoping and output-shaping conventions.

- [#4163](https://github.com/Urigo/accounter-fullstack/pull/4163)
  [`2b407d4`](https://github.com/Urigo/accounter-fullstack/commit/2b407d43b48dfa1cc3dc17cc634bdb22e663a320)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Complete the MCP tools' input surface,
  rename the scope field to membership terminology, and put an owner on every row.

  **Full filter coverage.** The tools wrapped only part of each upstream filter input, and the gap
  was silent — a predicate the schema supports was simply unreachable through MCP.

  - `accounter_search_charges` exposed 5 of 23 `ChargeFilter` fields; it now takes every predicate
    upstream honors (charge types, accountant status, counterparty and business trips, ordering, the
    `without*`/`with*` document/transaction/ledger flags), flat alongside its existing arguments.
    Both charge tools build their filter from one shared definition (`tools/charge-filters.ts`).
  - Date semantics are now separable and documented: `fromDate`/`toDate` remain the _overlap_ pair
    (upstream `fromAnyDate`/`toAnyDate`), and `fromMainDate`/`toMainDate` expose the narrower
    _containment_ pair. `sortBy` is caller-overridable, still defaulting to newest-first.
  - Pagination reaches results that were previously unreachable: `accounter_get_charges` takes
    `page`/`pageSize` (it was pinned to the first page of `allCharges`), and
    `accounter_list_businesses` takes `page` and forwards `limit`/`page` to `allBusinesses`. Both
    echo `pagination`.
  - `businessTrip`, `byFinancialAccounts` and `unbalanced` are deliberately **not** accepted:
    upstream takes them and never passes them to the SQL, and a filter that silently matches
    everything is worse for a model than an absent one.
  - New contract tests compare each tool's input keys against `input ChargeFilter` /
    `DocumentsFilters` / `TransactionsFilters` in the generated schema, so a field added upstream
    fails the suite instead of quietly becoming unreachable.

  **Membership terminology (breaking tool-input change).** The scope field was `businessIds`, one
  letter from the charge filter `byBusinesses` and the documents filter `businessIds` — both
  _counterparty_ predicates, a confusion that previously caused a real scoping bug. Every tool now
  takes `memberBusinessIds` (`memberBusinessId`, singular and required, on
  `accounter_balance_report`), responses echo `scope.memberBusinessIds`, and
  `accounter_list_business_memberships` emits `memberBusinessId` rows. Internals follow
  (`AuthorizedReadScope`, `BusinessMembership`, the policy and executor parameters). The
  `x-business-scope` header and the upstream payload keys are unchanged — they are contracts with
  the GraphQL server, not MCP vocabulary. **Callers passing `businessIds` now get a
  `VALIDATION_ERROR` rather than silently unscoped results.**

  **Owner on every row.** A caller with several memberships got a merged list it could not
  attribute: transactions carried no owner at all, and documents dropped theirs.

  - Server: `Charge`, `Document` and `Transaction` expose `ownerId: UUID!`, served off the row each
    type's shared DataLoader already fetches, so no query is added per row.
  - MCP: charges, transactions, documents, balance rows and the charge-nested `transactions` /
    `documents` all carry `ownerId`. `accounter_get_transactions` can now apply the same
    defense-in-depth owner filter as the charge and document tools, which previously relied on RLS
    alone.

  **Server, also:** `allCharges` now forwards `fromDate`/`toDate` to the provider. The SQL always
  had the containment predicate, but only the `*AnyDate` pair was wired up, so a caller passing
  `fromDate`/`toDate` got an unfiltered result instead of a narrower one.

- [#3941](https://github.com/Urigo/accounter-fullstack/pull/3941)
  [`b828023`](https://github.com/Urigo/accounter-fullstack/commit/b82802376c5f1f4acc5de274b58348d87fcbe553)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Introduce `@accounter/mcp-server`, a remote
  MCP (Model Context Protocol) server that exposes a curated, read-only subset of Accounter
  capabilities to Claude clients (see `docs/mcp/spec.md`).

  - Streamable HTTP transport on `POST /mcp` (JSON-RPC 2.0), plus `/health`, `/metrics`, and RFC
    9728 OAuth protected-resource discovery.
  - Auth0 access-token verification (jose/JWKS) with a per-tool authorization policy. Business
    memberships and roles are resolved server-side by forwarding the caller's bearer token to the
    Accounter `myMemberships` query — never read from token claims.
  - Phase 1 read tools: charges search, tags and tax-category lookups, and a selected report reader,
    behind an output-shaping/truncation framework.
  - Cross-cutting concerns: unified error taxonomy, rate limiting, structured request logging, and
    metrics/tracing.

- [#4107](https://github.com/Urigo/accounter-fullstack/pull/4107)
  [`c8e336f`](https://github.com/Urigo/accounter-fullstack/commit/c8e336fa5f1d7e5b79c697983e9d772a135b40dc)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Export MCP server traces to OpenTelemetry
  (Grafana Tempo) and link them with the backend.

  The MCP server's tracing was previously a dependency-free stub. It now emits real OpenTelemetry
  spans over OTLP/HTTP to the same Grafana Tempo backend as the main server, using the same `OTEL_*`
  configuration (disabled by default; enable with `OTEL_ENABLED=1` and an
  `OTEL_EXPORTER_OTLP_ENDPOINT`). Spans come from Node auto-instrumentation (incoming `POST /mcp`,
  and the outbound `fetch` to the upstream GraphQL API) plus the existing `withSpan` units of work
  (`auth:verify`, `tool:<name>`, `upstream:graphql`), each tagged with an `accounter.correlation_id`
  attribute.

  MCP and backend traces are linked two ways: the outbound `fetch` propagates the W3C `traceparent`
  header, so the Accounter server continues the same distributed trace; and a new
  `correlationIdPlugin` on the server records an inbound `X-Correlation-Id` as the
  `accounter.correlation_id` span attribute, so both services' traces are searchable by the same
  business-level id in Grafana.

### Patch Changes

- [#4077](https://github.com/Urigo/accounter-fullstack/pull/4077)
  [`8fd3132`](https://github.com/Urigo/accounter-fullstack/commit/8fd313234afd20a41e6e6dae8053fd0d12110ca3)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - - Added a shared `dates.ts` module
  exporting `TIMELESS_DATE`, `parseCalendarDate`, and `DAY_MS`.
  - Updated `tools/charges.ts` and `tools/reports.ts` to import those primitives from `./dates.js`
    and removed their local copies.
  - Avoided per-call redefinition of `parseCalendarDate` in `reports.ts` by using the shared
    implementation.

- [#4115](https://github.com/Urigo/accounter-fullstack/pull/4115)
  [`0aaebfb`](https://github.com/Urigo/accounter-fullstack/commit/0aaebfbb9565a73d16f488e0f89df809f1b98476)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Split the MCP businesses tools into
  memberships vs. the full directory.

  - **Rename** the membership-discovery tool `accounter_list_businesses` →
    `accounter_list_business_memberships`. Its behavior is unchanged (pure, no upstream call, lists
    the caller's own memberships and role in each), but the name now says what it returns. It
    remains the scope-discovery entry point and still leads `tools/list`.
  - **Add** `accounter_list_businesses`, a read-only lookup — alongside `accounter_list_tags` and
    `accounter_list_tax_categories` — that lists the full business directory (id, name, `ownerId`,
    active flag) via the upstream `allBusinesses` query, not just the caller's memberships. Optional
    `nameContains` (forwarded to the upstream `allBusinesses(name:)` filter so the server narrows
    before serializing), `activeOnly`, and `businessIds` filters, with the same deterministic sort +
    size cap and echoed `scope.businessIds` as the other lookups.

  **Breaking for connector callers**: the membership tool is now
  `accounter_list_business_memberships`. Any `MCP_TOOL_ALLOWLIST` that named
  `accounter_list_businesses` for scope discovery must be updated, since that name now refers to the
  full-directory lookup.

- [#4081](https://github.com/Urigo/accounter-fullstack/pull/4081)
  [`f899b37`](https://github.com/Urigo/accounter-fullstack/commit/f899b37a1561ef168398d122f214d9802178707d)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Coherent owner/business scoping for the MCP
  connector.

  The connector handled multi-business ownership three inconsistent ways and never forwarded the
  caller's business scope upstream, so scope-less queries could not be narrowed at all and results
  were not attributable to a business.

  **Server** — expose `Tag.ownerId` (`UUID!`), backed by a migration that appends `owner_id` to the
  `accounter_schema.extended_tags` view.

  **MCP server**

  - Forward the resolved read scope upstream as `x-business-scope` on every tool call, so RLS on the
    Accounter server is the enforcement point. The upstream context is built once where the scope is
    known, so a tool handler cannot omit it. The membership bootstrap (`myMemberships`) is
    deliberately never scoped — it is the query that discovers the scope.
  - Fix charges scoping: filter by `byOwners` (the owner predicate) instead of `byBusinesses` (the
    counterparty predicate, from which upstream removes the owner), which had been returning only
    inter-company charges. The balance report now uses the requested `businessId` rather than the
    first id in scope.
  - Add `accounter_list_businesses`, a read-only discovery tool listing the caller's businesses and
    role in each. Registered first so it leads `tools/list`; the internal `accounter_smoke_ping` is
    no longer advertised, though it remains dispatchable.
  - Uniform scoping contract: every business-scoped tool takes the same optional `businessIds`, rows
    carry `ownerId` (charges also `ownerName`), and responses echo the effective
    `scope.businessIds`. Out-of-scope ids are rejected rather than silently dropped.
  - Extend GraphQL codegen document discovery to `src/upstream/*.ts`, so the membership query is
    validated against the schema like the tool queries.

- [#4156](https://github.com/Urigo/accounter-fullstack/pull/4156)
  [`6e106e8`](https://github.com/Urigo/accounter-fullstack/commit/6e106e856c2e2a52b6451bc3d837c6e83e61612f)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Harden connection-dropout observability so
  idle spin-downs, cold starts, and client disconnects are diagnosable from the server side, and
  split token expiry from other auth failures.

  - Log the previously-silent `missing_token` 401 (with a `category` field) so tokenless reconnect
    probes are visible instead of a blind spot.
  - Meter `expired_token` separately from `invalid_token`: `TokenVerificationError` now carries an
    `expired` flag derived from jose's `ERR_JWT_EXPIRED`. The transport response is unchanged (RFC
    6750 `invalid_token` + `WWW-Authenticate`); only the metric bucket and log `category` differ,
    distinguishing "clients should refresh" from "tokens are misconfigured/abused".
  - Add `aborted`/`responseCompleted` (from `res.writableFinished`, so a disconnect after `end()`
    but before the flush completes is not miscounted as completed) and `uptimeSeconds` to completion
    logs, `msSinceLastRequest` to request-start logs, and `pid` to the startup log.

  Observability-only: no change to tools, transport behavior, or auth decisions.

- [#4108](https://github.com/Urigo/accounter-fullstack/pull/4108)
  [`edba2fc`](https://github.com/Urigo/accounter-fullstack/commit/edba2fc0f47bc87e2dfb8a4498697c2bd320f503)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - - Enrich detail tools to support
  filter-based retrieval in addition to by-id retrieval:
  - `accounter_get_charges` supports full `ChargeFilter` input.
  - `accounter_get_transactions` supports `transactionsByFilters` predicates.
  - `accounter_get_documents` supports `documentsByFilters` predicates.
  - Allow combining ids and filters in detail tools (ids + filters), and treat empty array inputs as
    undefined to match backend semantics.
  - Refactor detail-tool GraphQL documents to use shared fragments and one multi-operation document
    per tool, selecting operations with `operationName` to keep result structures consistent and
    reduce duplicate selection sets.
  - Normalize specific upstream not-found GraphQL errors from `chargesByIDs` / `transactionsByIDs`
    to empty successful results so out-of-scope or missing ids behave consistently with tool
    summaries.
  - Tighten `RawDocument.charge.owner` typing to match selected fields (`owner { id }`) and avoid
    accidental reliance on unselected `name` fields.

- [#4104](https://github.com/Urigo/accounter-fullstack/pull/4104)
  [`5bdb2c7`](https://github.com/Urigo/accounter-fullstack/commit/5bdb2c7e8817ab8ee1f08c6afb5dbabed4e1dd75)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Enforce `MCP_TOOL_ALLOWLIST`. The parsed
  allowlist was previously never read, so every registered tool was advertised and dispatchable
  regardless — harmless while phase 1 is read-only, but a real control gap once mutating tools land.
  `tools/list` now filters advertised tools through the allowlist and `tools/call` rejects an
  excluded tool as `Unknown tool` (indistinguishable from a nonexistent one, so the allowlist does
  not leak which capabilities exist). Semantics: an empty allowlist imposes no restriction (every
  tool exposed); a non-empty allowlist restricts to exactly the named tools. When narrowing, keep
  `accounter_list_businesses` in the set — it is the discovery entry point for business scoping.

- [#4123](https://github.com/Urigo/accounter-fullstack/pull/4123)
  [`0093f3b`](https://github.com/Urigo/accounter-fullstack/commit/0093f3b34abe51c346b1b41ddf891a3ae24ffbe5)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Fix unit tests that broke when the MCP tool
  limits were raised. Several tests hardcoded the old caps, so inputs meant to exceed a bound (a
  wide date range, an over-cap page size, a full lookup payload) became valid once the limits grew.
  The assertions now derive their boundary values from the exported constants (`MAX_PAGE_SIZE`,
  `MAX_DATE_RANGE_DAYS`, `MAX_REPORT_DATE_RANGE_DAYS`, `MAX_FILTERED_CHARGES`), and the byte-budget
  no-truncation case is pinned to a row count that genuinely fits the payload budget, so the suite
  tracks future limit changes.

- [#4105](https://github.com/Urigo/accounter-fullstack/pull/4105)
  [`64549f1`](https://github.com/Urigo/accounter-fullstack/commit/64549f15627899f397591585b4744dd1b0a392b2)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Key the rate limiter on `userId|toolName`
  instead of `userId|sortedScope|toolName`. Sorting already defeated permutation abuse, but distinct
  business-scope _subsets_ still mapped to distinct buckets, so a caller with N businesses could
  address up to 2^N−1 buckets per tool and multiply their effective quota — now that two tools
  accept a `businessIds` input. Every subset is already authorized, so scope in the key protected
  nothing and only fragmented the quota it is meant to bound. Tenant isolation is unaffected: it is
  enforced upstream by RLS via the forwarded `x-business-scope` header, not by the rate-limit key.

- [#4103](https://github.com/Urigo/accounter-fullstack/pull/4103)
  [`b61e81a`](https://github.com/Urigo/accounter-fullstack/commit/b61e81a03f3654389d6d600739ab01b375c266f1)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Tolerate a trailing slash on the MCP
  transport route. Previously only the exact path `/mcp` was routed, so `POST /mcp/` — a
  correct-looking URL — fell through to a `404` that was raised before the auth layer, so `/metrics`
  recorded nothing and the failure looked like an outage rather than a typo. Route lookup now
  normalizes the request path (stripping a trailing slash, preserving the root `/`), so `/mcp/`
  reaches the same handler, auth layer, and metrics as `/mcp`. `context.route` still carries the raw
  pathname for logging fidelity.

- [#4236](https://github.com/Urigo/accounter-fullstack/pull/4236)
  [`e31e806`](https://github.com/Urigo/accounter-fullstack/commit/e31e8066144076c5cbc73cba757156ecbb3d1b22)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - First write ("edit") tools for the MCP
  connector, behind an opt-in flag.

  Adds `accounter_update_charges_tags` and `accounter_upload_documents`, plus the shared write path
  they need. Writes are **off by default** (`MCP_ENABLE_WRITE_TOOLS=0`), so upgrading a running
  deployment never silently grants the model write access — an operator opts in per environment.

  **Write path** — reads and writes now travel separate, individually guarded methods on the
  upstream client. `query()` still refuses anything that is not a read; the new `mutate()` and
  `mutateMultipart()` refuse anything that is not a _single top-level mutation_, so neither can send
  the other's traffic. Writes are **never retried**: a mutation is not idempotent, and re-sending
  one that may already have applied upstream could double-apply it. `executeOnce` now takes a body
  builder, so headers, the timeout/abort budget, and error sanitization are shared across all three
  paths rather than duplicated. `mutateMultipart` implements the GraphQL multipart request spec
  (which graphql-yoga handles natively upstream), following the existing precedent in
  `packages/gmail-listener`.

  **Policy and gating**

  - `ToolAuthPolicy.mutating` gates exposure, forces a **single write-target business** — a read may
    span every membership, but an ambiguous write scope is refused with an actionable message rather
    than resolved by picking one — and triggers an audit line emitted _before_ the handler runs, so
    a call that then times out still leaves a record. The line carries identifiers and counts only,
    never file contents, filenames, or tokens.
  - New `MCP_ENABLE_WRITE_TOOLS` (`1`/`0`, default `0`). `isToolExposed` composes it with
    `MCP_TOOL_ALLOWLIST` one way only: the allowlist can narrow which write tools are exposed, but
    naming one in it can never turn writes on. A tool excluded by either control is reported as
    `Unknown tool`, exactly like a nonexistent one, so neither control announces what it is hiding.
  - `shapeWriteResult` joins `shapeListResult` in the shared output layer. It is deliberately
    asymmetric: a write's outcome is never droppable, so the payload guard applies only to the
    optional per-item echo — and drops that echo _whole_, since a half-echoed list of changed
    records would read as "these are the ones that changed", which would be false.

  **Tools**

  - `accounter_upload_documents` — attaches 1–10 documents to an **existing** charge. `chargeId` is
    required: upstream `batchUploadDocuments` creates a new charge when it is omitted, which is not
    a side effect the model should trigger by leaving a field blank. Documents arrive either as URLs
    the server fetches itself (preferred, no size limit) or as inline base64; each inline document
    is validated for encoding, MIME type, and size (256KB per file, 512KB per call, decoded)
    _before_ anything is uploaded — `Buffer.from(x, 'base64')` silently skips characters it does not
    recognize, so a truncated payload would otherwise decode to a plausible-looking short buffer and
    surface as a corrupt file much later. Upstream returns one result per file, so partial failure
    is reported positionally rather than collapsed.
  - `accounter_update_charges_tags` — adds and/or removes tags across 1–50 charges. Tags are given
    by id, never by name: names are not unique across owners, so resolving them here would mean
    guessing which of several same-named tags was meant — the model resolves them with
    `accounter_list_tags` first. The edit is incremental, not a replacement, and removals run before
    additions, so a tag id passed in both lists ends up added.

  `isSensitive` is pinned to `false` and deliberately absent from the input schema. The upstream
  name is misleading: `getOcrData` returns early with `documentType: UNPROCESSED` whenever it is
  set, so `true` does not so much mark a document sensitive as skip OCR entirely — documents
  uploaded through the tool would land with no amount, date, counterparty, or serial. Documents
  ingested here are meant to be read, so both branches pass `false`.

  The inline caps are small because inline base64 makes the _model_ the transport — it must emit the
  whole encoded file as tool arguments, and base64 tokenizes at roughly 3 characters per token, so a
  277KB PDF costs on the order of 100k output tokens. They are also pinned against
  `MAX_MCP_BODY_BYTES` by `tools/__tests__/upload-limits.test.ts`, because an earlier draft
  advertised 5MB per file while the 1MB body cap made that unreachable. Over-size errors name the
  URL path rather than just reporting a number: without that, the model's natural move is to
  re-encode a scanned receipt at lower quality until it fits, archiving a degraded copy of a legal
  financial record.

  Known gaps, filed as I6/I7 in `docs/todo.md`: writes carry no idempotency key (the server never
  retries, but a client retrying an upload whose result it never saw can duplicate the document),
  and the accountant-approval degradation that `batchUploadDocuments` performs upstream is not
  reflected in the tool's response.

- [#4235](https://github.com/Urigo/accounter-fullstack/pull/4235)
  [`4763c22`](https://github.com/Urigo/accounter-fullstack/commit/4763c22d2404a549806a083d0550e92960392694)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Add `accounter_explain_terminology`, a
  read-only glossary of Accounter's core domain vocabulary.

  Every other tool returns data; none explain what the data means, and the gaps are load-bearing. A
  "charge" is an aggregate grouping transactions, documents and ledger records for one economic
  event, not a bank charge. `byOwners` and `byBusinesses` ask opposite questions — owner versus
  counterparty — a distinction that has already caused a scoping bug here. `INTERNAL` and
  `CONVERSION` charges are money moving between the caller's own accounts and double-count in any
  spend total. Ledger slot 2 is the VAT split, so summing slot 1 alone drops the VAT leg. Only
  _business_ entities are required to balance; tax categories are expected to carry the residue.
  None of that is inferable from the schema, and it cannot live in per-tool `description` strings,
  which every caller pays for on every `tools/list` and which cannot carry concepts spanning tools.

  The tool carries 62 entries across six topics (`charge`, `transaction`, `document`, `ledger`,
  `entity`, `scope`). Called with no arguments it returns a one-line index of every term (~10 KB) so
  orientation is cheap; `terms` looks up specific ones and `topics` returns a whole area in full
  (~40 KB for everything, inside the 60 KB payload guard). Term matching folds case and separators,
  so enum tokens (`INTERNAL`), GraphQL type names (`InternalTransferCharge`) and field names
  (`effectiveDate`) all resolve, with a substring fallback. An unmatched term is reported under
  `unmatched` with suggestions rather than failing the call — a glossary that errors on an unknown
  word is useless for the case it exists for.

  Two properties set it apart from the other tools, both deliberate:

  - **Pure.** The handler never touches the upstream client, so there is no GraphQL call and no
    `x-business-scope` to forward. The registry-wide guard in `scope-forwarding.test.ts` grows a
    named `PURE_TOOLS` set rather than a loosened assertion, so a _data_ tool that drops scope still
    fails.
  - **Unscoped.** `requiresBusinessScope: false` with `dataClassification: 'public'` — static
    reference text with no customer data, readable by a caller with zero memberships, the same
    reasoning that applies to membership discovery.

  It registers second in `tools/list`, behind `accounter_list_business_memberships` and ahead of the
  data tools, so the discovery-first contract is unchanged.

  A glossary's failure mode is going stale silently, so the content is pinned to the package's own
  constants: `terminology-contract.test.ts` asserts that every `CHARGE_TYPES` token,
  `KNOWN_CHARGE_TYPENAMES` value and `ACCOUNTANT_STATUSES` token resolves to an entry, that every
  cross-reference names a real term and a registered tool, and that no alias is claimed by two
  entries. A charge type added upstream now fails the suite instead of quietly going undefined.

- [#4244](https://github.com/Urigo/accounter-fullstack/pull/4244)
  [`09a2e32`](https://github.com/Urigo/accounter-fullstack/commit/09a2e32d15d345b0592d7acce355060f070551fb)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Log every tool call as one structured
  `event: "tool_call"` line, with glossary lookups enriched.

  `accounter_explain_terminology` is a read of caller _intent_: what someone asks the glossary is
  the clearest available signal of the vocabulary they arrived with and what they were trying to do
  before they knew how to ask for data. None of it was being recorded. Nor was anything else about a
  tool call — `executeRegisteredTool` fed the in-memory metrics registry and returned, so a
  successful `tools/call` produced no log line at all, and the per-request logs in `server.ts`
  cannot fill the gap because every MCP call is the same `POST /mcp`. This also closes a documented
  gap: `docs/spec.md` §11.1 asks for per-request logs carrying `user_id`, `business_scope`,
  `tool_name`, outcome and `latency_ms`, none of which were logged.

  Every completed call now emits exactly one line tagged `event: "tool_call"` — on every path,
  including the validation, authorization and rate-limit rejections that never reach a handler —
  carrying `tool`, `outcome` (the same label set as the `requestsTotal` metric), `latencyMs`,
  `userId`, `correlationId`, `businessScopeSize`, and, for anything built with the shared list
  shaping, `returnedCount`/`totalCount`/`truncated`. `event` is a stable discriminator so the stream
  can be selected on without matching free-text messages.

  A tool enriches its own line through a new optional `observe(input, result)` hook on
  `ToolDefinition`. It is deliberately not a field on `ToolResult`: `tools/call` returns that object
  verbatim as the JSON-RPC payload, so telemetry attached there would be sent to every caller. The
  hook is pure, guarded against throwing (a broken hook must not turn a successful call into an
  error), and its fields are merged _beneath_ the canonical ones — a tool cannot misreport its own
  name, outcome, or caller.

  The glossary implements it with `glossaryMode`, `requestedTerms` (verbatim, so an alias the caller
  reached for stays visible), `matchedTerms` (canonical), `missedTerms` and `requestedTopics`, plus
  three label counters — `glossary_term_requests`, `glossary_term_misses` and `glossary_mode` —
  exposed under a new `labeledTotals` key on `GET /metrics`, so "most-requested term" and "terms we
  do not define yet" are one `curl` away and do not require parsing logs. Two decisions there are
  load-bearing:

  - **Matches are resolved from the input, not read back off the result.** A call carrying
    `topics: ["charge"]` returns every charge entry, and none of those was individually asked for;
    counting them would turn "most-requested term" into a measure of topic breadth. Index mode,
    which returns all 62 entries, credits no individual term at all for the same reason.
  - **Label cardinality is capped.** Miss labels derive from caller input, so they are folded (one
    concept, one label, regardless of spelling), clipped to 40 characters, and bounded at
    `MAX_COUNTER_LABELS` distinct labels per counter with further new labels folded into
    `__other__`. Labels already tracked keep counting, so the top-N stays accurate once the cap is
    reached. Worth knowing: `/metrics` is unauthenticated while calling a tool requires a valid
    token, so miss labels are authenticated-write and publicly readable — bounded to junk vocabulary
    by the folding and the caps, and the glossary tool is classified `public` with no customer data,
    but a reason to gate `/metrics` eventually.

  Guarded by a registry-wide test in the style of `scope-forwarding.test.ts`: it iterates the
  production registry and asserts every registered tool emits exactly one canonical `tool_call`
  line, so a tool added later cannot silently ship without usage logging.

- [#4236](https://github.com/Urigo/accounter-fullstack/pull/4236)
  [`e31e806`](https://github.com/Urigo/accounter-fullstack/commit/e31e8066144076c5cbc73cba757156ecbb3d1b22)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Upload documents by URL, so the bytes stop
  travelling through the model.

  Inline base64 made the _model_ the transport for every uploaded document, and that is the wrong
  place for a financial record to pass through: base64 has no redundancy, so a single mis-emitted
  character corrupts the file, and a 277KB PDF costs on the order of 100k output tokens before any
  server-side limit is even consulted. In practice the tool could only carry files small enough to
  be uninteresting.

  **Server: `batchUploadDocumentsFromUrls(urls, chargeId, isSensitive)`.** The server fetches each
  URL and hands the result to the existing `getDocumentFromFile`, so Cloudinary upload, OCR,
  hashing, and charge attachment are unchanged. Results are positional — one entry per input URL —
  so a partial failure names the URL that failed instead of sinking the batch.

  A server that fetches caller-supplied URLs is an SSRF primitive unless it is guarded, so
  `fetch-remote-document.helper.ts` refuses loopback, private, link-local (including the cloud
  metadata address), and carrier-grade-NAT ranges, plus `localhost`/`.local` by name and any
  non-http scheme. Redirects are followed **manually** and re-validated at every hop: checking only
  the submitted URL is the classic way this guard is bypassed, since the redirect target is
  attacker-controlled too. Bytes, redirects, and wall-clock time are all capped. The content type is
  taken from the _response_, never from the URL's extension — a `.pdf` link that answers with
  `text/html` is a login page, and storing it would file a web page as a financial record.

  Google Drive share links are routed through `GoogleDriveProvider`, which gains `isFileUrl` and
  `fetchFileFromUrl`. This is not optional politeness: `/file/d/<id>/view` returns an HTML page
  rather than the file, so a plain fetch would store the page. Going through the Drive API also
  reads files shared to the account rather than only public ones.

  **MCP: `documentUrls` on `accounter_upload_documents`.** Exactly one of `documentUrls` or
  `documents` per call, enforced by a schema refinement so the model gets one clear message rather
  than a pair of "no variant matched" branches. The URL branch has no size cap — the inline caps
  exist solely because base64 rides in the model's output, which a URL does not. The tool
  description now names URLs as the preferred path and inline base64 as the small-content fallback,
  and the over-size error points at `documentUrls` instead of merely reporting a number, so the
  model's next move is a link rather than a re-encoded, degraded copy of the receipt. The audit line
  records only `documentUrlsCount`, never the URLs themselves, which can carry access tokens.

- [#4236](https://github.com/Urigo/accounter-fullstack/pull/4236)
  [`e31e806`](https://github.com/Urigo/accounter-fullstack/commit/e31e8066144076c5cbc73cba757156ecbb3d1b22)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Give the write tools an `observe` hook, so
  their usage log line says what they did.

  The usage logging added in [#4244](https://github.com/urigo/accounter-fullstack/issues/4244)
  enriches a call's `tool_call` line from two sources: the shared list shaping
  (`returnedCount`/`totalCount`/`truncated`) and the tool's own `observe` hook. A write result has
  neither — `shapeWriteResult` produces an outcome, not a list — so a completed write logged _that_
  it happened and nothing about _what_ it did.

  - `accounter_upload_documents` reports `documentSource` (`urls` or `inline`),
    `requestedDocumentCount`, `uploadedCount` and `failedCount`, plus a `document_upload_source`
    label counter. That counter is the one worth watching: `inline` is capped at 256KB per file
    because the content rides in the model's own output, so a rising `inline` share means callers
    are still hitting a ceiling `documentUrls` removes entirely.
  - `accounter_update_charges_tags` reports `requestedChargeCount`, `updatedChargeCount`,
    `addedTagCount` and `removedTagCount`. The counts are reported separately because their
    difference is the signal — upstream silently skips a charge id it cannot resolve, so "asked for
    50, updated 43" is the shape of a model working from stale ids.

  Counts come from the finished result rather than the input, since upstream reports success per
  document and a partially failed batch is exactly the case worth seeing. Ids are deliberately left
  out: the `audit: true` line each write already emits _before_ its handler runs carries them, and
  repeating them here would double the noisiest field for no added answer. Neither line carries
  document content, filenames, or URLs — a signed download link carries an access token, and a test
  pins that.

  Also fixes the registry-wide usage-log guard, which iterates every registered tool and asserts a
  successful call: it had no arguments for the two write tools, so both were passing only by way of
  the validation-rejection path.

- [#4078](https://github.com/Urigo/accounter-fullstack/pull/4078)
  [`4e211ed`](https://github.com/Urigo/accounter-fullstack/commit/4e211ed9f629662bb3b20327fb11aa7d7842cdff)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - - Extend GraphQL codegen document discovery
  to include MCP server tool source files and generate `typescript-operations` output for the MCP
  server.
  - Update MCP tool handlers (`charges`, `lookups`, `reports`) to use generated `Mcp*Query` /
    `Mcp*QueryVariables` types instead of local `Raw*` interfaces.
  - Ensure the new generated MCP output directory is cleared as part of `generate:graphql:clear`.
