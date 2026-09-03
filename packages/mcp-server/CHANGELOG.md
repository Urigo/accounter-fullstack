# @accounter/mcp-server

## 0.1.0

### Minor Changes

- [#4288](https://github.com/Urigo/accounter-fullstack/pull/4288) [`64ec8b9`](https://github.com/Urigo/accounter-fullstack/commit/64ec8b96d223d316bb6388b929442d7f01be8cd1) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Filter charges that carry no tags at all.
  
  Server: `ChargeFilter` gains a `withoutTags: Boolean` predicate, honored by `allCharges` and
  `chargesWithMissingRequiredInfo` (both go through the shared charge listing helper). It narrows to
  charges with an empty tag set, and is independent of `byTags`, which narrows to charges carrying
  specific tags.
  
  Client: the charges filters modal gains a "Without Tags" toggle in the Missing Information section.
  
  MCP: `accounter_search_charges` and `accounter_get_charges` expose the new `withoutTags` filter.

- [#4282](https://github.com/Urigo/accounter-fullstack/pull/4282) [`1aa63fb`](https://github.com/Urigo/accounter-fullstack/commit/1aa63fba04165f5feb393d7316bd0da820aa403e) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Filter charges by financial account.
  
  `ChargeFilter.byFinancialAccounts` has been in the schema for a while but was never implemented:
  `allCharges` accepted it and then dropped it on the way to the provider, so it silently matched
  everything. It now filters.
  
  - **Server:** the `transactions_by_charge` CTE in `ChargesProvider.getChargesByFilters` aggregates
    `transactions.account_id` into an `account_array`, surfaced through `enriched_charges` and tested
    with an array-overlap predicate — so a charge matches when *any* of its transactions belongs to
    one of the selected accounts, the same shape already used for businesses and tags. The CTE
    already scans `transactions`, so no extra pass is added. The mapping lives in the shared
    `fetchFilteredCharges` helper, which means both All Charges and Missing Info Charges get the
    filter.
  - **Client:** a "Financial Accounts" multi-select on the charges filters modal, backed by the
    existing `useGetFinancialAccounts` query. Like every other field it round-trips through the
    `chargesFilters` URL param.
  - **MCP:** `byFinancialAccounts` is no longer listed as accepted-but-ignored. Both charge tools
    (`accounter_get_charges`, `accounter_search_charges`) now expose it and pass it upstream.

- [#4165](https://github.com/Urigo/accounter-fullstack/pull/4165) [`0af7271`](https://github.com/Urigo/accounter-fullstack/commit/0af7271b93affd33a48dfdaada9b41b7ee71a91b) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Add filterable ledger-record and contract queries, and expose them as dedicated MCP tools.
  
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

- [#4372](https://github.com/Urigo/accounter-fullstack/pull/4372) [`c259bc8`](https://github.com/Urigo/accounter-fullstack/commit/c259bc84da05aad771c52566a283686a92160b5b) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Expose each business's matched tax category on the MCP business directory.
  
  `accounter_list_businesses` returned a business's identity and status but nothing about how its
  charges book. A tax category is what a business is *for* in the ledger, so an assistant asked to
  categorize a charge, or to check that a counterparty is set up at all, had no way to tell an
  unmapped business from one already pointing at "Income" — the directory looked identical either way.
  The connector does list tax categories separately, but nothing joined the two: with the mapping
  invisible, the model's only honest move was to ask.
  
  Rows now carry `taxCategory` as `{ id, name }`, or `null` when no tax category is mapped to the
  business. The `null` is a real answer rather than a missing field: an auto-generated business with
  nothing matched yet is exactly the case worth acting on, and the `id` lines up with
  `accounter_list_tax_categories` rows without a second lookup.
  
  It reads through the existing `LtdFinancialEntity` inline fragment on `allBusinesses`, alongside
  `isClient`, and resolves through the business-id DataLoader — so it batches per page rather than
  adding a query per row, and no new upstream field was needed.

- [#4281](https://github.com/Urigo/accounter-fullstack/pull/4281) [`dc98359`](https://github.com/Urigo/accounter-fullstack/commit/dc983594b000a8af7eede4866c8b4aa818e3af4c) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Expose clients over the MCP connector.
  
  Some businesses are also clients — they carry a `clients` row that adds contact emails, a default
  document type, and a map of external-system ids. None of that reached the connector. The business
  directory came back with no signal about which rows were clients, so an assistant could not tell a
  supplier from a customer; and `accounter_get_contracts` had filtered by `clientIds` all along with
  nothing on the connector able to enumerate them.
  
  **A flag on the directory.** `accounter_list_businesses` rows now carry `isClient`, and the tool
  takes an `isClient` filter. The filter is a real upstream predicate rather than a pass over the
  returned page — `Query.allBusinesses` gained an `isClient` argument, applied ahead of the count and
  the slice, so `pagination` and `totalCount` describe the filtered directory and no page comes back
  short. That distinction matters more here than for `activeOnly`: clients are a small slice of the
  directory, so filtering an already-sliced page would answer "the clients on page 1" while reading as
  "the clients".
  
  **A tool for the detail.** `accounter_list_clients` returns emails, the client-level default
  document type, and the configured integrations, filtered by name or by `clientBusinessIds`. It is
  separate from the directory rather than more fields on it because the directory is thousands of rows
  against a hard payload cap, and hanging six integration ids off every row would spend that budget on
  the majority that have none. It is also where any future client data belongs. Unconfigured
  integrations are omitted rather than returned as `null`, and only `greenInvoiceInfo { greenInvoiceId }`
  is selected — every other field on that type is fetched from the external Green Invoice API, one
  request per client.
  
  Client ids need no translation anywhere: a client's id **is** its business id, so the directory's
  `id`, this tool's `businessId`, and the contracts filter's `clientIds` are one value.
  
  **Four server-side fixes underneath.** All pre-existing, all in the path of reading a client:
  
  - `ClientIntegrations` field resolvers parsed stored jsonb with a strict schema that threw on `NULL`
    and on any unknown key. Those resolvers run once per client, and the connector discards partial
    data whenever a response carries an `errors` entry — so one malformed row would have emptied an
    entire `allClients` call rather than degrading one record. Reading now goes through a lenient
    parser that treats `NULL` as unconfigured, strips unknown keys, and degrades a wrong-typed field to
    `null` without costing its siblings. Every one of the thirteen call sites was reading stored data,
    so all of them moved; the strict schema stays exported for a write path that wants it.
  - `Client.generatedDocumentType` was declared non-null with no resolver — the column is
    `document_type`, so the default resolver returned `undefined` and any query selecting it errored.
    Nothing selected it, which is why the break was invisible.
  - The same field was accepted by `insertClient`/`updateClient` and never written: neither statement
    touched `document_type`. It now persists.
  - `Client` gained `ownerId`, which every connector row is required to carry.
  
  Note that `generatedDocumentType` is the client-level default only. What actually gets issued is the
  contract's own `documentType`, which `accounter_get_contracts` already returns.

- [#4163](https://github.com/Urigo/accounter-fullstack/pull/4163) [`2b407d4`](https://github.com/Urigo/accounter-fullstack/commit/2b407d43b48dfa1cc3dc17cc634bdb22e663a320) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Complete the MCP tools' input surface, rename the scope field to membership terminology, and put an
  owner on every row.
  
  **Full filter coverage.** The tools wrapped only part of each upstream filter input, and the gap was
  silent — a predicate the schema supports was simply unreachable through MCP.
  
  - `accounter_search_charges` exposed 5 of 23 `ChargeFilter` fields; it now takes every predicate
    upstream honors (charge types, accountant status, counterparty and business trips, ordering, the
    `without*`/`with*` document/transaction/ledger flags), flat alongside its existing arguments. Both
    charge tools build their filter from one shared definition (`tools/charge-filters.ts`).
  - Date semantics are now separable and documented: `fromDate`/`toDate` remain the *overlap* pair
    (upstream `fromAnyDate`/`toAnyDate`), and `fromMainDate`/`toMainDate` expose the narrower
    *containment* pair. `sortBy` is caller-overridable, still defaulting to newest-first.
  - Pagination reaches results that were previously unreachable: `accounter_get_charges` takes
    `page`/`pageSize` (it was pinned to the first page of `allCharges`), and
    `accounter_list_businesses` takes `page` and forwards `limit`/`page` to `allBusinesses`. Both echo
    `pagination`.
  - `businessTrip`, `byFinancialAccounts` and `unbalanced` are deliberately **not** accepted: upstream
    takes them and never passes them to the SQL, and a filter that silently matches everything is worse
    for a model than an absent one.
  - New contract tests compare each tool's input keys against `input ChargeFilter` / `DocumentsFilters`
    / `TransactionsFilters` in the generated schema, so a field added upstream fails the suite instead
    of quietly becoming unreachable.
  
  **Membership terminology (breaking tool-input change).** The scope field was `businessIds`, one
  letter from the charge filter `byBusinesses` and the documents filter `businessIds` — both
  *counterparty* predicates, a confusion that previously caused a real scoping bug. Every tool now
  takes `memberBusinessIds` (`memberBusinessId`, singular and required, on `accounter_balance_report`),
  responses echo `scope.memberBusinessIds`, and `accounter_list_business_memberships` emits
  `memberBusinessId` rows. Internals follow (`AuthorizedReadScope`, `BusinessMembership`, the policy and
  executor parameters). The `x-business-scope` header and the upstream payload keys are unchanged — they
  are contracts with the GraphQL server, not MCP vocabulary. **Callers passing `businessIds` now get a
  `VALIDATION_ERROR` rather than silently unscoped results.**
  
  **Owner on every row.** A caller with several memberships got a merged list it could not attribute:
  transactions carried no owner at all, and documents dropped theirs.
  
  - Server: `Charge`, `Document` and `Transaction` expose `ownerId: UUID!`, served off the row each
    type's shared DataLoader already fetches, so no query is added per row.
  - MCP: charges, transactions, documents, balance rows and the charge-nested `transactions` /
    `documents` all carry `ownerId`. `accounter_get_transactions` can now apply the same
    defense-in-depth owner filter as the charge and document tools, which previously relied on RLS
    alone.
  
  **Server, also:** `allCharges` now forwards `fromDate`/`toDate` to the provider. The SQL always had
  the containment predicate, but only the `*AnyDate` pair was wired up, so a caller passing
  `fromDate`/`toDate` got an unfiltered result instead of a narrower one.

- [#4277](https://github.com/Urigo/accounter-fullstack/pull/4277) [`997938f`](https://github.com/Urigo/accounter-fullstack/commit/997938f393c1f5536dd497d9acb41398f551c644) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Expose securities over the MCP connector.
  
  The securities domain was reachable only through the web UI. An assistant connected over MCP knew
  securities as a charge *type* and nothing more: it could not say what the tenant holds, what it paid,
  what it traded, or which security is behind a charge.
  
  **Two new tools.** `accounter_list_security_holdings` is the portfolio — one row per security with
  units held, weighted average cost per unit bought, totals bought and sold, and the span of the
  ingested history, with a closed-position toggle and free-text search over name, symbol, ISIN,
  exchange, currency and every source identifier. Search, ordering (biggest live position first) and
  the row cap happen in the tool: upstream takes no search argument, a portfolio is tens to low
  hundreds of rows, and matching the `/securities` screen's own rules is what stops the two drifting.
  
  `accounter_get_security_executions` is the trade history behind it — buys, sales, dividends,
  interest, redemptions and transfers, newest first and really paginated, narrowed by security, trade
  date and kind. The three identity filters union with each other, since ids, ISINs and symbols are
  three ways of naming one axis; asking for one ISIN and one symbol means both securities, not the
  empty overlap.
  
  **The numbers carry their own caveats.** A position is arithmetic over a scraped trade history: the
  bank reports no holding, there are no market prices anywhere in the system, pre-history holdings and
  splits are invisible, a negative quantity means a history that starts mid-life, and a null amount
  means nothing was ingested rather than zero. Amounts are each security's own trade currency and are
  never converted. Asked what a portfolio is worth, a model will otherwise add a shekel column to a
  dollar one — so the holdings tool computes the sums that *are* valid, per currency, and emits a
  machine-readable `caveats` array alongside them. Quantities and average costs are never summed at
  all.
  
  **`includeSecurities` on `accounter_get_charges`**, following the existing `includeTransactions` /
  `includeDocuments` idiom. A foreign-securities charge is the one place where what happened is not in
  the charge: the cash leg is a bank row and the trade lives in a separate feed. Each security reports
  the `securityBusinessId` the other two tools are addressed by, so a charge answer can be followed
  into the portfolio. Three states stay distinct — not asked for, no key the feed knows, and a traded
  key whose reference scrape is stale.
  
  **Server:** a new `Query.securityExecutions(filters, page, limit, includeCharges)` with SQL pushdown,
  reusing the existing execution and page-info types. It has two paths, because charge links and
  pagination do not compose: `matchExecutionsToTransactions` is greedy and one-to-one over the sets it
  is handed, so pairing a page's slice would let an execution on page 2 claim the cash movement
  belonging to one on page 1 — the same execution reporting a different charge at a different page
  size. Requesting links therefore switches to an unpaginated match per security, capped at ten of
  them, and both paths order identically so they cannot disagree about what page 1 is. Also adds
  `SecurityBusiness.ownerId`, `SecurityHistoryExecution.securityBusiness` and
  `ChargeSecurity.securityBusiness`, so rows are owner-tagged, a flat cross-security list can be
  grouped, and a charge reaches the security's own identity through the key-to-ISIN bridge.
  
  **Migration:** the four securities tables' read predicates were still pinned to the singular
  `get_current_business_id()`. They were all created after `rls-multi-business-scope`, whose 45-table
  list they were never in, and no later migration broadened them. The consequence was a silent
  narrowing rather than a leak: a request whose scope spanned several businesses saw securities for one
  of them, with nothing in the response saying so. That broke the web client's business switcher, and
  it would have broken the connector harder — it forwards its resolved scope upstream and echoes that
  scope back, so the caller was told it had seen more than it had. Reads now follow
  `get_current_business_scope()` while **writes stay single-tenant**: `USING` is what selects the rows
  a statement may act on, and Postgres consults it for DELETE and UPDATE as well as SELECT, so
  widening it alone would authorize deleting another in-scope business's row — or updating one into
  the write target's ownership, moving it between businesses. Two restrictive per-command policies
  pin both back to the explicit target, and the scraper ingestion path is unaffected.
  
  Widening the read scope also changed what "unique" means underneath it. A Poalim security key is
  unique only *within* an owner, so two businesses that both trade one security carry it under the
  same key — ordinary for a multi-business tenant. While reads were pinned to one business a key-only
  lookup could not go wrong; spanning owners, it files one business's trades under the other's
  security. The execution queries now resolve the relation in SQL by joining the identifier bridge on
  `(owner_id, identifier_value)` and returning the security business per row, and the two lookups that
  remain in memory take an owner-qualified key.

- [#3941](https://github.com/Urigo/accounter-fullstack/pull/3941) [`b828023`](https://github.com/Urigo/accounter-fullstack/commit/b82802376c5f1f4acc5de274b58348d87fcbe553) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Introduce `@accounter/mcp-server`, a remote MCP (Model Context Protocol) server that exposes a
  curated, read-only subset of Accounter capabilities to Claude clients (see `docs/mcp/spec.md`).
  
  - Streamable HTTP transport on `POST /mcp` (JSON-RPC 2.0), plus `/health`, `/metrics`, and RFC 9728
    OAuth protected-resource discovery.
  - Auth0 access-token verification (jose/JWKS) with a per-tool authorization policy. Business
    memberships and roles are resolved server-side by forwarding the caller's bearer token to the
    Accounter `myMemberships` query — never read from token claims.
  - Phase 1 read tools: charges search, tags and tax-category lookups, and a selected report reader,
    behind an output-shaping/truncation framework.
  - Cross-cutting concerns: unified error taxonomy, rate limiting, structured request logging, and
    metrics/tracing.

- [#4107](https://github.com/Urigo/accounter-fullstack/pull/4107) [`c8e336f`](https://github.com/Urigo/accounter-fullstack/commit/c8e336fa5f1d7e5b79c697983e9d772a135b40dc) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Export MCP server traces to OpenTelemetry (Grafana Tempo) and link them with the backend.
  
  The MCP server's tracing was previously a dependency-free stub. It now emits real OpenTelemetry
  spans over OTLP/HTTP to the same Grafana Tempo backend as the main server, using the same `OTEL_*`
  configuration (disabled by default; enable with `OTEL_ENABLED=1` and an
  `OTEL_EXPORTER_OTLP_ENDPOINT`). Spans come from Node auto-instrumentation (incoming `POST /mcp`, and
  the outbound `fetch` to the upstream GraphQL API) plus the existing `withSpan` units of work
  (`auth:verify`, `tool:<name>`, `upstream:graphql`), each tagged with an `accounter.correlation_id`
  attribute.
  
  MCP and backend traces are linked two ways: the outbound `fetch` propagates the W3C `traceparent`
  header, so the Accounter server continues the same distributed trace; and a new `correlationIdPlugin`
  on the server records an inbound `X-Correlation-Id` as the `accounter.correlation_id` span
  attribute, so both services' traces are searchable by the same business-level id in Grafana.

### Patch Changes

- [#4077](https://github.com/Urigo/accounter-fullstack/pull/4077) [`8fd3132`](https://github.com/Urigo/accounter-fullstack/commit/8fd313234afd20a41e6e6dae8053fd0d12110ca3) Thanks [@gilgardosh](https://github.com/gilgardosh)! - - Added a shared `dates.ts` module exporting `TIMELESS_DATE`, `parseCalendarDate`, and `DAY_MS`.
  - Updated `tools/charges.ts` and `tools/reports.ts` to import those primitives from `./dates.js` and
    removed their local copies.
  - Avoided per-call redefinition of `parseCalendarDate` in `reports.ts` by using the shared
    implementation.

- [#4289](https://github.com/Urigo/accounter-fullstack/pull/4289) [`4e0a883`](https://github.com/Urigo/accounter-fullstack/commit/4e0a88388b7a4cec23636473010dcb4a54672800) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Implement the `ChargeFilter` exclusion predicates, and expose them through the MCP charge tools.
  
  `excludedBusinesses`, `excludedFinancialAccounts`, `excludedTags` and `excludedFreeText` were added
  to the schema alongside the charges filter redesign so the client could send them, with the SQL
  deliberately deferred. Until now `allCharges` accepted all four and silently ignored them — picking
  "exclude" in the filter modal returned an unfiltered result with no indication the constraint had
  been dropped. They now have real predicates.
  
  `getChargesByFilters` already aggregates each charge's businesses, tags and accounts into arrays
  before its closing `WHERE`, so the three entity exclusions are array **non**-overlap rather than the
  `NOT EXISTS` the follow-up doc originally called for — a charge is dropped when any of its
  businesses / tags / accounts appears in the exclusion list. Each is wrapped in `COALESCE`, because
  those arrays come from `LEFT JOIN`s and `NULL && array` is `NULL`: without it, a tag exclusion would
  have dropped every charge that has no tags at all.
  
  `excludedFreeText` is a set-membership test. A new `excluded_matches` CTE mirrors the existing
  `search_matches` across the same eight sources — charge description, transaction
  description/reference, document description/remarks/serial, transaction and document amounts, and
  counterparty names via transactions, creditor and debtor — and `filtered_charges` requires the charge
  not to appear in it. Every branch requires the parameter to be non-null, the inverse of
  `search_matches`, whose first branch deliberately passes everything through when `$freeText` is null.
  A charge with no text never enters the set, so "does not mention X" keeps charges with no
  description — the NULL-safety concern the follow-up doc raised does not arise, because nothing
  negates an `ILIKE`. Thousands separators are stripped as they are for `freeText`, so excluding
  `1,234.56` also excludes `1234.56`.
  
  Include and exclude are separate predicates, `AND`ed, so a value named in both lists is excluded —
  exclude wins. The client's tri-state cannot produce that, but the API allows it.
  
  All four are removed from the MCP server's `UNSUPPORTED_UPSTREAM_CHARGE_FILTER_FIELDS` and exposed on
  `accounter_get_charges` and `accounter_search_charges`, which makes "mentions X but not Y" and
  "everything except these accounts" expressible by a model for the first time. `unbalanced` and
  `businessTrip` stay on that list — they remain accepted-but-ignored.
  
  Both text predicates are now normalized at the provider: a value that is empty once trimmed becomes
  `NULL` rather than reaching SQL as an empty string, which would degrade to `ILIKE '%%'`. As an
  exclusion that would have dropped nearly every charge — reachable through the MCP tools, whose
  `.min(2)` accepted two spaces — and the same latent bug existed on the pre-existing `freeText` path,
  where it instead drops the charges whose description is `NULL`. The mapping layer and the MCP input
  schema now reject whitespace-only text as well, so it fails at the edge. The numeric variants are
  only set when the term contains a digit, since those branches compare against `amount::TEXT` and a
  digit-free term can never match one.
  
  One editing hazard found and documented: **pgTyped silently truncates the generated parameter list at
  the first `--` comment inside the closing `WHERE` clause.** An explanatory comment placed there cut
  `IGetChargesByFiltersParams` from 30-odd entries to ten, taking `tags`, `accountIds` and `sortColumn`
  with it. Comments inside CTEs are unaffected. There is now a note above the `sql` template, and
  `docs/charges-filters/backend-followup.md` records it.

- [#4115](https://github.com/Urigo/accounter-fullstack/pull/4115) [`0aaebfb`](https://github.com/Urigo/accounter-fullstack/commit/0aaebfbb9565a73d16f488e0f89df809f1b98476) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Split the MCP businesses tools into memberships vs. the full directory.
  
  - **Rename** the membership-discovery tool `accounter_list_businesses` →
    `accounter_list_business_memberships`. Its behavior is unchanged (pure, no upstream call, lists the
    caller's own memberships and role in each), but the name now says what it returns. It remains the
    scope-discovery entry point and still leads `tools/list`.
  - **Add** `accounter_list_businesses`, a read-only lookup — alongside `accounter_list_tags` and
    `accounter_list_tax_categories` — that lists the full business directory (id, name, `ownerId`,
    active flag) via the upstream `allBusinesses` query, not just the caller's memberships. Optional
    `nameContains` (forwarded to the upstream `allBusinesses(name:)` filter so the server narrows
    before serializing), `activeOnly`, and `businessIds` filters, with the same deterministic
    sort + size cap and echoed `scope.businessIds` as the other lookups.
  
  **Breaking for connector callers**: the membership tool is now `accounter_list_business_memberships`.
  Any `MCP_TOOL_ALLOWLIST` that named `accounter_list_businesses` for scope discovery must be updated,
  since that name now refers to the full-directory lookup.

- [#4299](https://github.com/Urigo/accounter-fullstack/pull/4299) [`fda81a4`](https://github.com/Urigo/accounter-fullstack/commit/fda81a488b51b5a5b17764f11a7bd5d1f0963639) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Log the MCP `initialize` handshake, so a client changing underneath this connector is visible.
  
  The connector recently went blind — every tool returned its summary line and no rows — because rows
  lived only in `structuredContent`, a field a client may ignore, and the client's handling of it
  changed. Establishing that took a rollback test plus reading Claude Desktop's own log directory,
  because this server records **nothing** about who connects: `initialize` never read `request.params`
  and never logged. The one hop with no trace was the one that mattered.
  
  Every `initialize` now emits one structured line tagged `event: "mcp_initialize"`, joining
  `tool_call` as the second selectable event. It carries `clientName` / `clientVersion` (the fields
  that date a client-side change), `requestedProtocolVersion` vs `servedProtocolVersion`, a
  `protocolVersionMismatch` boolean, `clientCapabilities` (names only — the values are unbounded and
  caller-supplied), and the usual `userId` / `correlationId` so a session can be joined across both
  events.
  
  Three decisions are load-bearing:
  
  - **Logged from `dispatchMcpRequest`, not from the `case 'initialize'` that builds the response.**
    `handleRpcRequest` is the pure, env-free half and takes only the request — it has neither the
    caller nor the correlation id. Delegating to it afterwards keeps the response built in exactly one
    place, so the two cannot drift. The sync `handleMcpBody` path has no production call sites and
    stays silent, which leaves its existing test of the pure response shape untouched.
  - **`describeInitializeParams` is total.** `params` is `unknown` off the wire and validated only as
    a non-null object *or array*, so every field is narrowed there and anything unexpected degrades to
    `null`/`[]`. A malformed handshake must still produce a line: a client sending something this
    server cannot parse is precisely the event worth seeing, and an exception there would lose it.
  - **Caller-derived fields are spread beneath the canonical ones**, matching the `tool_call` line.
    Without that, `clientInfo` would be an authenticated way to attribute a call to a different
    `userId`. Client strings are also clipped before reaching the log.
  
  Deliberately excluded: a `labeledTotals` counter keyed by client version. `/metrics` is
  unauthenticated while calling a tool requires a token — already flagged as worth closing — and
  client identity is a fingerprint of the deployment, so it belongs in the log (durable, access-
  controlled by the platform) rather than on a public endpoint. Worth revisiting once `/metrics` is
  gated.
  
  Also deliberately excluded: protocol-version *negotiation*. The server keeps answering `2025-06-18`
  unconditionally; this only records what was asked. Changing what the server advertises is a live
  behavioral change to a connector that has just broken once, and it should be decided against a
  logged mismatch rather than a guess — which is what `protocolVersionMismatch` now provides.

- [#4295](https://github.com/Urigo/accounter-fullstack/pull/4295) [`2f42953`](https://github.com/Urigo/accounter-fullstack/commit/2f42953b7f10c468e67636aa93444ec9d571272d) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Mirror every tool payload into `content`, so rows actually reach the model.
  
  The connector had gone blind: asking for a counterparty's charges returned
  `Found 7 charge(s) across 2 businesses; showing 7 on page 1 of 1.` and nothing else — no ids, dates,
  amounts or business names. Every tool behaved the same way, and the model could not work around it
  by changing filters, because there was nothing to filter.
  
  **Cause.** Every list tool funnels through `shapeListResult`, which put the summary line in `content`
  and the rows *only* in `structuredContent`. Under MCP 2025-06-18 `structuredContent` is
  contractually meaningful only when a tool advertises an `outputSchema` — none of ours ever have, and
  none ever did — so a client is free to ignore it, and the spec correspondingly asks a server
  returning structured content to *also* return it serialized in a `TextContent` block. This server
  did neither, and every tool's data depended on undefined-by-spec client behaviour. When the client
  stopped surfacing unschema'd structured content, the rows stopped arriving.
  
  This was never a regression here: `shapeListResult`'s return statement was byte-identical to its
  original from the very first commit of the package, and `executeRegisteredTool` /
  `dispatchMcpRequest` pass the result through untouched. It was an original design gap that only
  became visible when the assumption underneath it changed.
  
  **Fix.** A single `mirroredResult(summary, structured)` in `src/tools/output.ts`, which
  `shapeListResult`, `shapeWriteResult` and `toToolErrorResult` all now return through. The summary
  still leads — a cheap orientation line before the payload — followed by the serialized JSON, with
  `structuredContent` kept as-is for hosts that consume it directly. Deliberately one function rather
  than a per-tool convention: the failure mode being fixed is exactly the kind that drifts back one
  tool at a time. No tool handler changed; all seventeen already route through those three functions.
  
  Two things this restores that were less obvious than the missing rows:
  
  - `accounter_list_business_memberships` instructs the model to "Pass their `memberBusinessId`
    values", while those ids lived only in the invisible field. Discovery that cannot be acted on
    breaks the scoping workflow every other tool depends on.
  - Error payloads were mirrored too. `VALIDATION_ERROR` carries field-level `issues`, and a rejected
    call whose issues never reach the model tells it only *that* it was wrong, never *what* to fix — so
    it retries the same shape. `accounter_explain_terminology` was likewise returning the entire
    glossary into a field nothing read.
  
  The 60KB budget is unchanged and still measures what the model consumes: `fittingCount` binary-
  searches on `JSON.stringify(structured)`, which is now exactly the mirrored text. The JSON-RPC body
  roughly doubles, which is far under the 1MB transport cap. A client that renders both channels sees
  the payload twice; that is the accepted cost of not depending on which one it reads.
  
  **Guarded by `tools/__tests__/mirroring-contract.test.ts`**, because the real failure here was that
  the suite stayed green while the connector was blind — rows were asserted exclusively through
  `structuredContent`, and no test anywhere checked that one reached `content`. It closes that in two
  layers: a sweep over the production registry asserting any `structuredContent` is carried by a
  `content` block, and a source-level check that no tool builds a `content` array by hand. The second
  layer exists because the first has a blind spot — with an empty upstream most data tools return a
  *mirrored error*, so a new tool hand-rolling an unmirrored success could otherwise slip past it.

- [#4310](https://github.com/Urigo/accounter-fullstack/pull/4310) [`5751475`](https://github.com/Urigo/accounter-fullstack/commit/57514754d6905828b36112f867dffb71a7773671) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Detect and log requests from clients speaking a newer MCP protocol era.
  
  This connector implements a handshake-based protocol revision. The current revision removed
  `initialize` entirely — version, identity and capabilities now travel per-request in `_meta`. A
  client that moved there completely would simply stop handshaking, which means the handshake logging
  added earlier **cannot** warn us about it: `mcp_initialize` would go quiet rather than report a
  changed version, and the first real symptom would be failing calls. That is the same shape as the
  incident that prompted all of this, and worse — a legacy-only server answering a modern-only client
  fails outright rather than returning partial results.
  
  What makes it detectable in advance is that a dual-era client on Streamable HTTP tries a modern
  request **first** and falls back based on the response. That attempt is the warning, and until now
  nothing was looking for it.
  
  Any request carrying one of these emits a single `event: "mcp_modern_probe"` line at `warn`, with
  the method, the client identity it advertised, and the revision it named:
  
  - `MCP-Protocol-Version` whose value disagrees with what we serve — a header this server has never
    read, which is half of a real conformance gap in our own revision (we observe it; we still do not
    enforce it, because enforcement changes behavior)
  - a per-request `_meta` protocol version, client info, or capabilities
  - the modern-only `server/discover` method
  
  Deliberately quiet otherwise. `MCP-Protocol-Version` is required by the revision we already
  implement, so it may well be on every call; recording its presence would make this event mean "a
  request happened" rather than "something changed", and `mcp_initialize` already reports the
  negotiated version.
  
  **Observation only, and that is the load-bearing property.** Era detection keys off exactly what a
  server returns: a dual-era client decides we are legacy from the shape of our reply. Answering
  `server/discover`, or anything else that makes us look modern, would stop the fallback that is
  currently keeping every client working — the failure this is meant to warn about, caused by the
  warning. So `server/discover` still returns method-not-found, and a test asserts responses are
  byte-identical whether or not a probe was detected.
  
  `describeModernEraProbe` is pure and total in the same way as `describeInitializeParams`: everything
  it reads is caller-supplied and unvalidated, and a probe this server cannot parse is precisely the
  event worth seeing rather than throwing on.
  
  Capability names copied out of caller input are bounded — each clipped, the set capped at 20 with a
  trailing `+N more` so a truncated list is visibly truncated. Both how many keys a caller sends and
  how long each one is are bounded only by the 1 MB body cap, so a verbatim copy into a log line was
  caller-controlled amplification: a ~600KB payload produced a ~613KB log line, and now produces a
  1.4KB one. The same fix applies to `describeInitializeParams`, which shipped with the identical
  unbounded copy and is already released — this corrects both.
  
  Runbook §3.2 documents the fields, the `jq` recipes, and — since the point of this is to be a trigger
  — what to do when it fires.

- [#4081](https://github.com/Urigo/accounter-fullstack/pull/4081) [`f899b37`](https://github.com/Urigo/accounter-fullstack/commit/f899b37a1561ef168398d122f214d9802178707d) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Coherent owner/business scoping for the MCP connector.
  
  The connector handled multi-business ownership three inconsistent ways and never forwarded the
  caller's business scope upstream, so scope-less queries could not be narrowed at all and results were
  not attributable to a business.
  
  **Server** — expose `Tag.ownerId` (`UUID!`), backed by a migration that appends `owner_id` to the
  `accounter_schema.extended_tags` view.
  
  **MCP server**
  
  - Forward the resolved read scope upstream as `x-business-scope` on every tool call, so RLS on the
    Accounter server is the enforcement point. The upstream context is built once where the scope is
    known, so a tool handler cannot omit it. The membership bootstrap (`myMemberships`) is deliberately
    never scoped — it is the query that discovers the scope.
  - Fix charges scoping: filter by `byOwners` (the owner predicate) instead of `byBusinesses` (the
    counterparty predicate, from which upstream removes the owner), which had been returning only
    inter-company charges. The balance report now uses the requested `businessId` rather than the first
    id in scope.
  - Add `accounter_list_businesses`, a read-only discovery tool listing the caller's businesses and
    role in each. Registered first so it leads `tools/list`; the internal `accounter_smoke_ping` is no
    longer advertised, though it remains dispatchable.
  - Uniform scoping contract: every business-scoped tool takes the same optional `businessIds`, rows
    carry `ownerId` (charges also `ownerName`), and responses echo the effective `scope.businessIds`.
    Out-of-scope ids are rejected rather than silently dropped.
  - Extend GraphQL codegen document discovery to `src/upstream/*.ts`, so the membership query is
    validated against the schema like the tool queries.

- [#4156](https://github.com/Urigo/accounter-fullstack/pull/4156) [`6e106e8`](https://github.com/Urigo/accounter-fullstack/commit/6e106e856c2e2a52b6451bc3d837c6e83e61612f) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Harden connection-dropout observability so idle spin-downs, cold starts, and
  client disconnects are diagnosable from the server side, and split token expiry
  from other auth failures.
  
  - Log the previously-silent `missing_token` 401 (with a `category` field) so
    tokenless reconnect probes are visible instead of a blind spot.
  - Meter `expired_token` separately from `invalid_token`: `TokenVerificationError`
    now carries an `expired` flag derived from jose's `ERR_JWT_EXPIRED`. The
    transport response is unchanged (RFC 6750 `invalid_token` + `WWW-Authenticate`);
    only the metric bucket and log `category` differ, distinguishing "clients
    should refresh" from "tokens are misconfigured/abused".
  - Add `aborted`/`responseCompleted` (from `res.writableFinished`, so a
    disconnect after `end()` but before the flush completes is not miscounted as
    completed) and `uptimeSeconds` to completion logs, `msSinceLastRequest` to
    request-start logs, and `pid` to the startup log.
  
  Observability-only: no change to tools, transport behavior, or auth decisions.

- [#4108](https://github.com/Urigo/accounter-fullstack/pull/4108) [`edba2fc`](https://github.com/Urigo/accounter-fullstack/commit/edba2fc0f47bc87e2dfb8a4498697c2bd320f503) Thanks [@gilgardosh](https://github.com/gilgardosh)! - - Enrich detail tools to support filter-based retrieval in addition to by-id retrieval:
    - `accounter_get_charges` supports full `ChargeFilter` input.
    - `accounter_get_transactions` supports `transactionsByFilters` predicates.
    - `accounter_get_documents` supports `documentsByFilters` predicates.
  - Allow combining ids and filters in detail tools (ids + filters), and treat empty array inputs as
    undefined to match backend semantics.
  - Refactor detail-tool GraphQL documents to use shared fragments and one multi-operation document per
    tool, selecting operations with `operationName` to keep result structures consistent and reduce
    duplicate selection sets.
  - Normalize specific upstream not-found GraphQL errors from `chargesByIDs` / `transactionsByIDs` to
    empty successful results so out-of-scope or missing ids behave consistently with tool summaries.
  - Tighten `RawDocument.charge.owner` typing to match selected fields (`owner { id }`) and avoid
    accidental reliance on unselected `name` fields.

- [#4104](https://github.com/Urigo/accounter-fullstack/pull/4104) [`5bdb2c7`](https://github.com/Urigo/accounter-fullstack/commit/5bdb2c7e8817ab8ee1f08c6afb5dbabed4e1dd75) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Enforce `MCP_TOOL_ALLOWLIST`. The parsed allowlist was previously never read, so
  every registered tool was advertised and dispatchable regardless — harmless
  while phase 1 is read-only, but a real control gap once mutating tools land.
  `tools/list` now filters advertised tools through the allowlist and `tools/call`
  rejects an excluded tool as `Unknown tool` (indistinguishable from a nonexistent
  one, so the allowlist does not leak which capabilities exist). Semantics: an
  empty allowlist imposes no restriction (every tool exposed); a non-empty
  allowlist restricts to exactly the named tools. When narrowing, keep
  `accounter_list_businesses` in the set — it is the discovery entry point for
  business scoping.

- [#4123](https://github.com/Urigo/accounter-fullstack/pull/4123) [`0093f3b`](https://github.com/Urigo/accounter-fullstack/commit/0093f3b34abe51c346b1b41ddf891a3ae24ffbe5) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Fix unit tests that broke when the MCP tool limits were raised. Several tests
  hardcoded the old caps, so inputs meant to exceed a bound (a wide date range, an
  over-cap page size, a full lookup payload) became valid once the limits grew.
  The assertions now derive their boundary values from the exported constants
  (`MAX_PAGE_SIZE`, `MAX_DATE_RANGE_DAYS`, `MAX_REPORT_DATE_RANGE_DAYS`,
  `MAX_FILTERED_CHARGES`), and the byte-budget no-truncation case is pinned to a
  row count that genuinely fits the payload budget, so the suite tracks future
  limit changes.

- [#4105](https://github.com/Urigo/accounter-fullstack/pull/4105) [`64549f1`](https://github.com/Urigo/accounter-fullstack/commit/64549f15627899f397591585b4744dd1b0a392b2) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Key the rate limiter on `userId|toolName` instead of
  `userId|sortedScope|toolName`. Sorting already defeated permutation abuse, but
  distinct business-scope *subsets* still mapped to distinct buckets, so a caller
  with N businesses could address up to 2^N−1 buckets per tool and multiply their
  effective quota — now that two tools accept a `businessIds` input. Every subset
  is already authorized, so scope in the key protected nothing and only fragmented
  the quota it is meant to bound. Tenant isolation is unaffected: it is enforced
  upstream by RLS via the forwarded `x-business-scope` header, not by the
  rate-limit key.

- [#4103](https://github.com/Urigo/accounter-fullstack/pull/4103) [`b61e81a`](https://github.com/Urigo/accounter-fullstack/commit/b61e81a03f3654389d6d600739ab01b375c266f1) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Tolerate a trailing slash on the MCP transport route. Previously only the exact
  path `/mcp` was routed, so `POST /mcp/` — a correct-looking URL — fell through
  to a `404` that was raised before the auth layer, so `/metrics` recorded nothing
  and the failure looked like an outage rather than a typo. Route lookup now
  normalizes the request path (stripping a trailing slash, preserving the root
  `/`), so `/mcp/` reaches the same handler, auth layer, and metrics as `/mcp`.
  `context.route` still carries the raw pathname for logging fidelity.

- [#4236](https://github.com/Urigo/accounter-fullstack/pull/4236) [`e31e806`](https://github.com/Urigo/accounter-fullstack/commit/e31e8066144076c5cbc73cba757156ecbb3d1b22) Thanks [@gilgardosh](https://github.com/gilgardosh)! - First write ("edit") tools for the MCP connector, behind an opt-in flag.
  
  Adds `accounter_update_charges_tags` and `accounter_upload_documents`, plus the shared write path
  they need. Writes are **off by default** (`MCP_ENABLE_WRITE_TOOLS=0`), so upgrading a running
  deployment never silently grants the model write access — an operator opts in per environment.
  
  **Write path** — reads and writes now travel separate, individually guarded methods on the upstream
  client. `query()` still refuses anything that is not a read; the new `mutate()` and
  `mutateMultipart()` refuse anything that is not a *single top-level mutation*, so neither can send
  the other's traffic. Writes are **never retried**: a mutation is not idempotent, and re-sending one
  that may already have applied upstream could double-apply it. `executeOnce` now takes a body builder,
  so headers, the timeout/abort budget, and error sanitization are shared across all three paths rather
  than duplicated. `mutateMultipart` implements the GraphQL multipart request spec (which graphql-yoga
  handles natively upstream), following the existing precedent in `packages/gmail-listener`.
  
  **Policy and gating**
  
  - `ToolAuthPolicy.mutating` gates exposure, forces a **single write-target business** — a read may
    span every membership, but an ambiguous write scope is refused with an actionable message rather
    than resolved by picking one — and triggers an audit line emitted *before* the handler runs, so a
    call that then times out still leaves a record. The line carries identifiers and counts only, never
    file contents, filenames, or tokens.
  - New `MCP_ENABLE_WRITE_TOOLS` (`1`/`0`, default `0`). `isToolExposed` composes it with
    `MCP_TOOL_ALLOWLIST` one way only: the allowlist can narrow which write tools are exposed, but
    naming one in it can never turn writes on. A tool excluded by either control is reported as
    `Unknown tool`, exactly like a nonexistent one, so neither control announces what it is hiding.
  - `shapeWriteResult` joins `shapeListResult` in the shared output layer. It is deliberately
    asymmetric: a write's outcome is never droppable, so the payload guard applies only to the optional
    per-item echo — and drops that echo *whole*, since a half-echoed list of changed records would read
    as "these are the ones that changed", which would be false.
  
  **Tools**
  
  - `accounter_upload_documents` — attaches 1–10 documents to an **existing** charge.
    `chargeId` is required: upstream `batchUploadDocuments` creates a new charge when it is omitted,
    which is not a side effect the model should trigger by leaving a field blank. Documents arrive
    either as URLs the server fetches itself (preferred, no size limit) or as inline base64; each
    inline document is validated for encoding, MIME type, and size (256KB per file, 512KB per call,
    decoded) *before* anything is uploaded —
    `Buffer.from(x, 'base64')` silently skips characters it does not recognize, so a truncated payload
    would otherwise decode to a plausible-looking short buffer and surface as a corrupt file much
    later. Upstream returns one result per file, so partial failure is reported positionally rather
    than collapsed.
  - `accounter_update_charges_tags` — adds and/or removes tags across 1–50 charges. Tags are given by
    id, never by name: names are not unique across owners, so resolving them here would mean guessing
    which of several same-named tags was meant — the model resolves them with `accounter_list_tags`
    first. The edit is incremental, not a replacement, and removals run before additions, so a tag id
    passed in both lists ends up added.
  
  `isSensitive` is pinned to `false` and deliberately absent from the input schema. The upstream name
  is misleading: `getOcrData` returns early with `documentType: UNPROCESSED` whenever it is set, so
  `true` does not so much mark a document sensitive as skip OCR entirely — documents uploaded through
  the tool would land with no amount, date, counterparty, or serial. Documents ingested here are meant
  to be read, so both branches pass `false`.
  
  The inline caps are small because inline base64 makes the *model* the transport — it must emit the
  whole encoded file as tool arguments, and base64 tokenizes at roughly 3 characters per token, so a
  277KB PDF costs on the order of 100k output tokens. They are also pinned against
  `MAX_MCP_BODY_BYTES` by `tools/__tests__/upload-limits.test.ts`, because an earlier draft advertised
  5MB per file while the 1MB body cap made that unreachable. Over-size errors name the URL path
  rather than just reporting a number: without that, the model's natural move is to
  re-encode a scanned receipt at lower quality until it fits, archiving a degraded copy of a legal
  financial record.
  
  Known gaps, filed as I6/I7 in `docs/todo.md`: writes carry no idempotency key (the server never
  retries, but a client retrying an upload whose result it never saw can duplicate the document), and
  the accountant-approval degradation that `batchUploadDocuments` performs upstream is not reflected in
  the tool's response.

- [#4302](https://github.com/Urigo/accounter-fullstack/pull/4302) [`35842e6`](https://github.com/Urigo/accounter-fullstack/commit/35842e61639815ce951a8dafcf5d46f90f6417c0) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Collapse the three hand-written money shapes onto one.
  
  `normalizeAmount` in `tools/entity-shapes.ts` is meant to be the single definition of how money
  appears in a tool result, but the same `raw -> value` mapping had been rewritten by hand in
  `search_charges` (`charges.ts`) and `balance_report` (`reports.ts`). Three copies, nothing keeping
  them in step — drift that had already started rather than a hypothetical one.
  
  Both now call `normalizeAmount`. The emitted JSON is unchanged: same keys, same values, same order.
  The only type-level change is that a balance-report row's `amount` is now `NormalizedAmount | null`
  rather than non-nullable. That is the safe direction — the value is never null in practice, and a
  shape that permits more than it emits cannot violate a schema, which matters if these rows ever get
  a declared `outputSchema`.
  
  Pinned by a contract test in `entity-shapes.test.ts` that asserts the key set against the tools'
  real output rather than by grepping the source, so a fourth copy that happens to be correct today
  still has to stay correct. Verified it bites: reintroducing the mapping with `amount` in place of
  `value` fails with `expected [ 'amount', 'currency', 'formatted' ] to deeply equal [ 'currency',
  'formatted', 'value' ]`.
  
  Context: this is groundwork from the blind-connector postmortem. Any future `outputSchema` has to be
  generated from a single source to be truthful, and the money shape was the clearest place where that
  single source had already been lost.

- [#4235](https://github.com/Urigo/accounter-fullstack/pull/4235) [`4763c22`](https://github.com/Urigo/accounter-fullstack/commit/4763c22d2404a549806a083d0550e92960392694) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Add `accounter_explain_terminology`, a read-only glossary of Accounter's core domain vocabulary.
  
  Every other tool returns data; none explain what the data means, and the gaps are load-bearing. A
  "charge" is an aggregate grouping transactions, documents and ledger records for one economic event,
  not a bank charge. `byOwners` and `byBusinesses` ask opposite questions — owner versus counterparty —
  a distinction that has already caused a scoping bug here. `INTERNAL` and `CONVERSION` charges are
  money moving between the caller's own accounts and double-count in any spend total. Ledger slot 2 is
  the VAT split, so summing slot 1 alone drops the VAT leg. Only _business_ entities are required to
  balance; tax categories are expected to carry the residue. None of that is inferable from the schema,
  and it cannot live in per-tool `description` strings, which every caller pays for on every
  `tools/list` and which cannot carry concepts spanning tools.
  
  The tool carries 62 entries across six topics (`charge`, `transaction`, `document`, `ledger`,
  `entity`, `scope`). Called with no arguments it returns a one-line index of every term (~10 KB) so
  orientation is cheap; `terms` looks up specific ones and `topics` returns a whole area in full
  (~40 KB for everything, inside the 60 KB payload guard). Term matching folds case and separators, so
  enum tokens (`INTERNAL`), GraphQL type names (`InternalTransferCharge`) and field names
  (`effectiveDate`) all resolve, with a substring fallback. An unmatched term is reported under
  `unmatched` with suggestions rather than failing the call — a glossary that errors on an unknown word
  is useless for the case it exists for.
  
  Two properties set it apart from the other tools, both deliberate:
  
  - **Pure.** The handler never touches the upstream client, so there is no GraphQL call and no
    `x-business-scope` to forward. The registry-wide guard in `scope-forwarding.test.ts` grows a named
    `PURE_TOOLS` set rather than a loosened assertion, so a _data_ tool that drops scope still fails.
  - **Unscoped.** `requiresBusinessScope: false` with `dataClassification: 'public'` — static reference
    text with no customer data, readable by a caller with zero memberships, the same reasoning that
    applies to membership discovery.
  
  It registers second in `tools/list`, behind `accounter_list_business_memberships` and ahead of the
  data tools, so the discovery-first contract is unchanged.
  
  A glossary's failure mode is going stale silently, so the content is pinned to the package's own
  constants: `terminology-contract.test.ts` asserts that every `CHARGE_TYPES` token,
  `KNOWN_CHARGE_TYPENAMES` value and `ACCOUNTANT_STATUSES` token resolves to an entry, that every
  cross-reference names a real term and a registered tool, and that no alias is claimed by two entries.
  A charge type added upstream now fails the suite instead of quietly going undefined.

- [#4306](https://github.com/Urigo/accounter-fullstack/pull/4306) [`1143eec`](https://github.com/Urigo/accounter-fullstack/commit/1143eec8fe44d43895db07a45fdbc63ec06c5034) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Document each tool's result in its description, since that is the only channel that reaches the
  model.
  
  Two things were measured on Claude Desktop after the blind-connector incident, and both are now
  recorded in `docs/connector-gaps-and-decisions.md`:
  
  1. The model is shown **neither** `structuredContent` nor a declared `outputSchema`. The first
     caused the incident; the second was established by declaring a schema on one canary tool and
     asking. After ruling out a cached `tools/list` with a marker string, the model enumerated the
     loaded definition as name, description, input schema — "There is no output schema."
  2. Desktop **defers tool definitions**. Until the model loads one, it sees roughly the first
     sentence of the description.
  
  Asked what a tool returns, the model reconstructed the shape from *sibling* descriptions and then
  named precisely what it could not know: whether rows sit under `businesses` or `memberships`, and
  whether there is a `scope` echo. That is the gap this closes.
  
  - **`resultEnvelopeDescription(itemsKey)`** and **`writeResultDescription(itemsKey)`** live in
    `output.ts` next to the functions that build those envelopes, so the prose and the shape cannot
    drift apart. Same idiom as `SCOPE_DESCRIPTION_SUFFIX`: one shared clause, so the model learns the
    envelope once rather than in fifteen phrasings. No description previously mentioned
    `returnedCount`, `totalCount`, `truncated`, `continuation` or `itemsOmitted` at all.
  - **Both write tools** documented nothing about their result. A model that has just changed data
    could not tell what confirmation to expect — including that `itemsOmitted` means the write
    *applied* and only the echo was dropped, which reads like a failure if you have not been told.
  - **`accounter_list_business_memberships` is front-loaded.** Its scope-discovery instruction — call
    it first, pass the returned ids onward — was sentence two and did not arrive under deferred
    loading. It is now part of sentence one, which is the only sentence guaranteed to be read.
  - **`accounter_list_tags` and `accounter_list_tax_categories`** named no output fields; they now name
    their actual keys, including `namePath` and `sortCode`.
  - **Prose replaced by literal keys** where the two diverged: "file/image links" are `fileUrl` /
    `imageUrl`, and "total, VAT, withholding" are `totalAmount` / `vat` / `withholdingTax`. A
    near-miss name is worse than no name, because it reads authoritative.
  
  Deliberately surgical rather than a rewrite. Most of these descriptions are carefully built — the
  securities and upload ones especially — and the measured gap was narrow: where rows live, what the
  envelope carries, and a handful of prose-versus-key mismatches.
  
  Guarded by `description-contract.test.ts`: every list tool must name its own `itemsKey` and the four
  envelope fields, every write tool must name its items key plus `ok` / `action` / `itemsOmitted`, a
  first sentence has to carry more than a restatement of the tool's name, and no description may
  contain a line break, a doubled space, or stray outer whitespace. That last check exists because
  this changeset's own first draft shipped `\n` escapes into three descriptions — invisible in a diff,
  verbatim to the model.

- [#4244](https://github.com/Urigo/accounter-fullstack/pull/4244) [`09a2e32`](https://github.com/Urigo/accounter-fullstack/commit/09a2e32d15d345b0592d7acce355060f070551fb) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Log every tool call as one structured `event: "tool_call"` line, with glossary lookups enriched.
  
  `accounter_explain_terminology` is a read of caller *intent*: what someone asks the glossary is the
  clearest available signal of the vocabulary they arrived with and what they were trying to do before
  they knew how to ask for data. None of it was being recorded. Nor was anything else about a tool
  call — `executeRegisteredTool` fed the in-memory metrics registry and returned, so a successful
  `tools/call` produced no log line at all, and the per-request logs in `server.ts` cannot fill the gap
  because every MCP call is the same `POST /mcp`. This also closes a documented gap: `docs/spec.md`
  §11.1 asks for per-request logs carrying `user_id`, `business_scope`, `tool_name`, outcome and
  `latency_ms`, none of which were logged.
  
  Every completed call now emits exactly one line tagged `event: "tool_call"` — on every path,
  including the validation, authorization and rate-limit rejections that never reach a handler —
  carrying `tool`, `outcome` (the same label set as the `requestsTotal` metric), `latencyMs`, `userId`,
  `correlationId`, `businessScopeSize`, and, for anything built with the shared list shaping,
  `returnedCount`/`totalCount`/`truncated`. `event` is a stable discriminator so the stream can be
  selected on without matching free-text messages.
  
  A tool enriches its own line through a new optional `observe(input, result)` hook on
  `ToolDefinition`. It is deliberately not a field on `ToolResult`: `tools/call` returns that object
  verbatim as the JSON-RPC payload, so telemetry attached there would be sent to every caller. The
  hook is pure, guarded against throwing (a broken hook must not turn a successful call into an error),
  and its fields are merged *beneath* the canonical ones — a tool cannot misreport its own name,
  outcome, or caller.
  
  The glossary implements it with `glossaryMode`, `requestedTerms` (verbatim, so an alias the caller
  reached for stays visible), `matchedTerms` (canonical), `missedTerms` and `requestedTopics`, plus
  three label counters — `glossary_term_requests`, `glossary_term_misses` and `glossary_mode` — exposed
  under a new `labeledTotals` key on `GET /metrics`, so "most-requested term" and "terms we do not
  define yet" are one `curl` away and do not require parsing logs. Two decisions there are load-bearing:
  
  - **Matches are resolved from the input, not read back off the result.** A call carrying
    `topics: ["charge"]` returns every charge entry, and none of those was individually asked for;
    counting them would turn "most-requested term" into a measure of topic breadth. Index mode, which
    returns all 62 entries, credits no individual term at all for the same reason.
  - **Label cardinality is capped.** Miss labels derive from caller input, so they are folded (one
    concept, one label, regardless of spelling), clipped to 40 characters, and bounded at
    `MAX_COUNTER_LABELS` distinct labels per counter with further new labels folded into `__other__`.
    Labels already tracked keep counting, so the top-N stays accurate once the cap is reached. Worth
    knowing: `/metrics` is unauthenticated while calling a tool requires a valid token, so miss labels
    are authenticated-write and publicly readable — bounded to junk vocabulary by the folding and the
    caps, and the glossary tool is classified `public` with no customer data, but a reason to gate
    `/metrics` eventually.
  
  Guarded by a registry-wide test in the style of `scope-forwarding.test.ts`: it iterates the
  production registry and asserts every registered tool emits exactly one canonical `tool_call` line,
  so a tool added later cannot silently ship without usage logging.

- [#4236](https://github.com/Urigo/accounter-fullstack/pull/4236) [`e31e806`](https://github.com/Urigo/accounter-fullstack/commit/e31e8066144076c5cbc73cba757156ecbb3d1b22) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Upload documents by URL, so the bytes stop travelling through the model.
  
  Inline base64 made the *model* the transport for every uploaded document, and that is the wrong
  place for a financial record to pass through: base64 has no redundancy, so a single mis-emitted
  character corrupts the file, and a 277KB PDF costs on the order of 100k output tokens before any
  server-side limit is even consulted. In practice the tool could only carry files small enough to be
  uninteresting.
  
  **Server: `batchUploadDocumentsFromUrls(urls, chargeId, isSensitive)`.** The server fetches each URL
  and hands the result to the existing `getDocumentFromFile`, so Cloudinary upload, OCR, hashing, and
  charge attachment are unchanged. Results are positional — one entry per input URL — so a partial
  failure names the URL that failed instead of sinking the batch.
  
  A server that fetches caller-supplied URLs is an SSRF primitive unless it is guarded, so
  `fetch-remote-document.helper.ts` refuses loopback, private, link-local (including the cloud metadata
  address), and carrier-grade-NAT ranges, plus `localhost`/`.local` by name and any non-http scheme.
  Redirects are followed **manually** and re-validated at every hop: checking only the submitted URL is
  the classic way this guard is bypassed, since the redirect target is attacker-controlled too. Bytes,
  redirects, and wall-clock time are all capped. The content type is taken from the *response*, never
  from the URL's extension — a `.pdf` link that answers with `text/html` is a login page, and storing
  it would file a web page as a financial record.
  
  Google Drive share links are routed through `GoogleDriveProvider`, which gains `isFileUrl` and
  `fetchFileFromUrl`. This is not optional politeness: `/file/d/<id>/view` returns an HTML page rather
  than the file, so a plain fetch would store the page. Going through the Drive API also reads files
  shared to the account rather than only public ones.
  
  **MCP: `documentUrls` on `accounter_upload_documents`.** Exactly one of `documentUrls` or
  `documents` per call, enforced by a schema refinement so the model gets one clear message rather than
  a pair of "no variant matched" branches. The URL branch has no size cap — the inline caps exist
  solely because base64 rides in the model's output, which a URL does not. The tool description now
  names URLs as the preferred path and inline base64 as the small-content fallback, and the over-size
  error points at `documentUrls` instead of merely reporting a number, so the model's next move is a
  link rather than a re-encoded, degraded copy of the receipt. The audit line records only
  `documentUrlsCount`, never the URLs themselves, which can carry access tokens.

- [#4236](https://github.com/Urigo/accounter-fullstack/pull/4236) [`e31e806`](https://github.com/Urigo/accounter-fullstack/commit/e31e8066144076c5cbc73cba757156ecbb3d1b22) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Give the write tools an `observe` hook, so their usage log line says what they did.
  
  The usage logging added in [#4244](https://github.com/urigo/accounter-fullstack/issues/4244) enriches a call's `tool_call` line from two sources: the shared
  list shaping (`returnedCount`/`totalCount`/`truncated`) and the tool's own `observe` hook. A write
  result has neither — `shapeWriteResult` produces an outcome, not a list — so a completed write
  logged *that* it happened and nothing about *what* it did.
  
  - `accounter_upload_documents` reports `documentSource` (`urls` or `inline`),
    `requestedDocumentCount`, `uploadedCount` and `failedCount`, plus a `document_upload_source` label
    counter. That counter is the one worth watching: `inline` is capped at 256KB per file because the
    content rides in the model's own output, so a rising `inline` share means callers are still
    hitting a ceiling `documentUrls` removes entirely.
  - `accounter_update_charges_tags` reports `requestedChargeCount`, `updatedChargeCount`,
    `addedTagCount` and `removedTagCount`. The counts are reported separately because their difference
    is the signal — upstream silently skips a charge id it cannot resolve, so "asked for 50, updated
    43" is the shape of a model working from stale ids.
  
  Counts come from the finished result rather than the input, since upstream reports success per
  document and a partially failed batch is exactly the case worth seeing. Ids are deliberately left
  out: the `audit: true` line each write already emits *before* its handler runs carries them, and
  repeating them here would double the noisiest field for no added answer. Neither line carries
  document content, filenames, or URLs — a signed download link carries an access token, and a test
  pins that.
  
  Also fixes the registry-wide usage-log guard, which iterates every registered tool and asserts a
  successful call: it had no arguments for the two write tools, so both were passing only by way of
  the validation-rejection path.

- [#4078](https://github.com/Urigo/accounter-fullstack/pull/4078) [`4e211ed`](https://github.com/Urigo/accounter-fullstack/commit/4e211ed9f629662bb3b20327fb11aa7d7842cdff) Thanks [@gilgardosh](https://github.com/gilgardosh)! - - Extend GraphQL codegen document discovery to include MCP server tool source files and generate
    `typescript-operations` output for the MCP server.
  - Update MCP tool handlers (`charges`, `lookups`, `reports`) to use generated `Mcp*Query` /
    `Mcp*QueryVariables` types instead of local `Raw*` interfaces.
  - Ensure the new generated MCP output directory is cleared as part of `generate:graphql:clear`.

- [#4305](https://github.com/Urigo/accounter-fullstack/pull/4305) [`d8d5d61`](https://github.com/Urigo/accounter-fullstack/commit/d8d5d61e28203093f675d1ca31696462d0b53dd9) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Fix document uploads failing at the final INSERT with "TenantAwareDBClient is already disposed"
  
  Uploading a document through the MCP connector timed out and left the charge untouched, every time.
  The mutation was running to completion server-side and dying on its last step: the caller's abort
  disposed the request's DB client while the resolver was still working, so `insertDocuments` — after
  a Drive download, a Cloudinary upload and an OCR pass — threw `TenantAwareDBClient is already
  disposed`, and the follow-up field resolvers threw the same. Nothing was ever written, and the
  connector reported the timeout as retryable, so each retry paid the full cost again.
  
  Fixed at every layer it goes through:
  
  - **Request lifecycle** — a caller hanging up no longer stops the operation this server is running.
    `dbCleanupPlugin` now *defers* disposal (`disposeWhenIdle`) while GraphQL execution is in flight,
    so the work finishes and writes, and the client is released at the end of execution.
  - **Leak watchdog** — gains separate idle ceilings for a client whose operation is still executing
    (`POSTGRES_ACTIVE_CLIENT_MAX_IDLE_MS`, 15 min) and one whose caller already hung up
    (`POSTGRES_ABORTED_CLIENT_MAX_IDLE_MS`, 2.5 min — this is what bounds the deferral above). A
    request that goes minutes without a query because it is waiting on OCR is no longer mistaken for a
    leak.
  - **Document ingestion** — `releaseIdleConnection` hands the pooled connection back before the
    download / Cloudinary / OCR stretch instead of holding it `idle in transaction` throughout, so
    those requests no longer sit in the pool (or in reach of `idle_in_transaction_session_timeout`)
    while they wait on an external API.
  - **Google Drive** — every Drive call now has a 60s timeout (`fetch` has none by default, so an
    unanswered call pinned the request indefinitely), and Drive failures keep their reason in the
    message instead of collapsing to "Failed fetching files from Google Drive".
  - **`batchUploadDocumentsFromUrls`** — a failing insert is reported per URL like every other failure
    in that resolver, rather than sinking the whole batch into one opaque GraphQL error.
  - **MCP connector** — document uploads get their own budget, `GRAPHQL_UPSTREAM_LONG_TIMEOUT_MS`
    (default 5 min), instead of the 10s budget sized for a database read. A timed-out write is now
    reported as **not** retryable, with a message saying to check whether it took effect first —
    re-sending one that may still be in progress upstream risks duplicating it.
