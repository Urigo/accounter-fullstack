# Exposing the GraphQL schema through MCP — evaluation

Status: Proposal / research. Owner: unassigned. Last updated: 2026-09-12.

Evaluates a proposed extension to `@accounter/mcp-server`:

1. **A filtered schema surface** — expose a deliberately small subset of queries, types and fields,
   widened gradually as confidence grows.
2. **Automated exposure** — beyond the allow/deny filter, no per-capability code: descriptions, type
   definitions and arguments come straight from the schema.
3. **A schema-navigation tool** — the agent describes what it needs in prose; the tool answers with
   the schema path/steps to get it, saving tokens and capturing intent close to the user's wording.

It covers what already exists in open source, what building it here would actually cost, and what
the idea is missing.

## Summary

- **Nothing off the shelf can be adopted.** Every mature option is the wrong runtime (Rust, .NET,
  Java), the wrong curation model, or has no filtering at all. One — `graphql-codegen-mcp-tools` —
  fits the stack, but answers a different question (§2).
- **Building it is affordable**: ~1,000–1,400 lines, roughly three curated tools' worth, in exchange
  for retiring the marginal cost of all future ones (§4).
- **Requirement 3 is the strongest part of the proposal** and the one with real ecosystem
  validation. It also pays off on its own, without the execution tool, and should ship first (§3,
  §6).
- **Requirement 1 buys less safety than it looks like it buys.** A schema subset is a smaller
  infinite space, not a finite one; it bounds context and blast radius, not cost or authorization
  (§2, §5.5).
- **The two hard blockers are both outside the tool.** The schema documents its types but barely
  documents its root fields and almost never its arguments (§5.1), and the server has no
  depth/complexity/cost limiting of any kind (§5.3).
- **Requirement 2's "no further code needed" is 80% true.** Automation removes the plumbing; the
  domain prose in `terminology-data.ts` has no automated substitute (§5.7).
- **There is a design the proposal skips**, and it is the one everyone with adoption chose: automate
  tool generation from _authored operations_ rather than exposing a schema subset (§5.11).

---

## 1. Baseline — what we are starting from

Numbers measured against `main` on 2026-09-12, not estimates.

### The schema

| Property                                        | Value                                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `Query` root fields                             | 108                                                                              |
| `Mutation` root fields                          | 146                                                                              |
| Named types                                     | 398 (200 `type`, 99 `input`, 50 `enum`, 27 `union`, 12 `interface`, 10 `scalar`) |
| Field definitions                               | 2,021 output + 1,293 input                                                       |
| SDL size                                        | 6,425 lines / ~183 KB printed (~49k tokens unminified)                           |
| Named types carrying a description              | 398 of 398 (100%)                                                                |
| `Query` root fields carrying a description      | **16 of 108 (15%)**                                                              |
| Output fields carrying a description            | 228 of 2,021 (11%)                                                               |
| Input fields carrying a description             | 116 of 1,293 (9%)                                                                |
| Field arguments carrying a description          | **9 of 373 (2%)**                                                                |
| Field-level auth directives                     | 410 (`@requiresAuth` 225, `@requiresAnyRole` 140, `@requiresRole` 45)            |
| Depth / complexity / cost limiting              | **none anywhere in the server**                                                  |
| Root fields defaulting to `limit: Int = 999999` | 5                                                                                |

Counted by parsing the module typeDefs with `graphql-js`, not by grep. Three groups of rows decide
most of what follows.

**The schema documents its types but not its interface.** Every one of the 398 named types carries a
description — but only 16 of 108 `Query` root fields do, and only 9 of 373 field arguments. The
documentation sits on the nouns and is absent from the verbs and their parameters, which is exactly
backwards for a consumer that has to pick an entry point and fill in its arguments. See §5.1.

**The auth directives are real enforcement**, not annotation. `auth-directives.ts` wraps every
field's resolver through `mapSchema`, so authorization is a property of the schema rather than of
the calling tool. Combined with the `x-business-scope` header narrowing via RLS upstream, an
arbitrary document sent by a model is subject to exactly the same checks as a curated one.

**There is no query-cost control of any kind.** No depth limit, no complexity or cost analysis, no
persisted operations, no GraphQL Armor. Today the only thing bounding the shape of a query is that
every document in this repository was written by a human. A generic execution tool removes that
bound and replaces it with nothing.

### The connector

- 17 curated tools, 7,245 lines under `src/tools/` — about 6,100 of that in the tool files
  themselves, roughly 300–600 lines each.
- `MAX_TOOL_RESULT_BYTES = 60_000`, enforced centrally in `output.ts`.
- `terminology-data.ts` is 848 lines of domain glossary — the largest single file in the package.
- Read-only is enforced by a regex over the document text
  (`NON_READ_OPERATION_RE = /\b(mutation|subscription)\b/i`), not by an AST check.

### The prior decision this reverses

`docs/spec.md` §8.3 says "Avoid a generic runGraphQL tool because it bypasses curated safety
controls", §3.2 lists "No broad GraphQL passthrough tool" as a phase-1 non-goal, and §15 lists "no
generic GraphQL execution tool" as the mitigation for accidental overexposure.
`docs/implementation-blueprint.md` repeats it twice. That decision is not wrong on its own terms —
it just predates the measurement that the auth directives and RLS, not the tool boundary, are what
actually enforce access. **Whatever ships here has to amend those documents in the same change**,
with the reasoning, or the next person reads the spec and reverts it.

---

## 2. Open source for requirements 1 + 2

Seven projects were examined. None is droppable in; three are worth stealing from.

| Project                                                                                                   | Runtime     | Curation model                                                     | Fit        |
| --------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------ | ---------- |
| [Apollo MCP Server](https://github.com/apollographql/apollo-mcp-server) (MIT, 307★)                       | Rust binary | Operation files / persisted-query manifests, or full introspection | reference  |
| [`@graphql-hive/plugin-mcp`](https://www.npmjs.com/package/@graphql-hive/plugin-mcp)                      | TS          | `@mcpTool` directives on named operations                          | reference  |
| [`graphql-codegen-mcp-tools`](https://www.labdigital.nl/blog/generating-mcp-tools-from-graphql-schemas)   | TS          | `@mcpTool` directives → codegen → persisted documents              | **usable** |
| [`graphql-mcp`](https://github.com/graphql-mcp/graphql-mcp) (MIT, 1★)                                     | C# / Java   | `ExcludedFields` / `ExcludedTypes` globs + depth/complexity gates  | reference  |
| [`mcp-graphql`](https://github.com/blurrah/mcp-graphql) (MIT, 406★)                                       | TS          | none                                                               | no         |
| [`mcp-graphql-schema`](https://github.com/hannesj/mcp-graphql-schema) (MIT, 47★)                          | TS          | none (strips built-ins)                                            | no         |
| [Semantic Introspection](https://chillicream.com/blog/2026/04/22/semantic-introspection/) (Hot Chocolate) | .NET        | n/a — a spec RFC                                                   | reference  |

**Apollo MCP Server** is the closest functional fit for requirements 2 and 3 together, and the wrong
runtime: a separate Rust process cannot reuse our Auth0 verifier, membership resolution,
`x-business-scope` forwarding, rate limiter, audit log or 60 KB output budget. Read it for the
design of `search` / `introspect` (§3), not as a dependency.

**`@graphql-hive/plugin-mcp`** requires Hive Gateway in front of the Yoga server, which is a much
larger change than the tool being proposed. Its `@mcpTool` / `@mcpDescription` / `@mcpHeader`
directives are the good idea worth taking: the marker for "expose this" lives next to the thing
being exposed.

**`graphql-codegen-mcp-tools`** is the only option that fits the stack as-is. We already run
graphql-codegen, and `codegen.ts` already scans `packages/mcp-server/src/tools/*.ts` for documents,
so annotating operations with `@mcpTool` and generating tool definitions plus persisted documents is
a small delta. It is worth a serious look — but note that it answers a _different_ question than the
one asked: it automates writing tools from **operations we author**, not from a **schema subset the
model composes against**. That may in fact be the better answer (§5 and §6).

**`graphql-mcp`** (C#/Java, 1★) is the only project anywhere whose curation model is a schema subset
rather than an operation list, and it pairs that subset with depth limits, complexity gates and
argument-complexity thresholds. The pairing is the lesson.

### The pattern in the data

Every mature option curates at the **operation** level — a fixed set of named, persisted documents,
each becoming one MCP tool. Nobody with real adoption curates at the **schema-subset** level, which
is what requirement 1 asks for. That is not an accident:

- A persisted operation is trivially safe. Its cost, depth, shape and returned fields are all fixed
  at build time, so there is nothing left to bound at runtime.
- A schema subset is a _smaller_ infinite space, not a finite one. The model still composes the
  query, so every runtime control a full passthrough needs, a subset needs too.

This matters for the plan: **requirement 1 does not, on its own, buy the safety it looks like it
buys.** It bounds blast radius and context size. It does not bound cost, depth or output volume, and
it is not the authorization boundary (§5.5).

### What that leaves

Nothing to adopt wholesale. But the parts that are genuinely hard in this domain — OAuth, token
verification, membership resolution, scope forwarding, rate limiting, the audit log, the output
budget, telemetry — are already built here and are exactly what every off-the-shelf option would
make us give up. What is missing is library-shaped, and mostly already in our dependency tree.

---

## 3. Open source for requirement 3

This is the part with clear ecosystem validation, and it is converging on one shape.

**Apollo MCP Server's `search` tool.** Indexes type names, field names and descriptions with English
stemming and lowercasing — **lexical, not embeddings**. Ranks by relevance, boosted by shorter
distance from the `Query` root. Returns not just matches but the related types needed to write a
valid operation, tree-shaken to a configurable depth with input types retained at unlimited depth.
Capped at 5 results. Apollo measures the search + minify path at 3–6 tool calls and 3,200–5,300
tokens against 10–12 calls and 5,000–9,500 tokens for traversal introspection — roughly 40% less
schema context.

The important detail is that **it needs no vector store and no embedding provider.** Requirement 3
is a stemmed inverted index plus a graph walk, not an ML feature.

**ChilliCream's Semantic Introspection** (an RFC against the GraphQL spec, implemented in Hot
Chocolate preview) splits it into two fields: `__search(query: "...")` returns ranked schema members
with the _path from the query root_, and `__definitions(coordinates: [...])` fetches the details for
the coordinates the agent picked.

That two-step split is the right shape and it is heading into the specification. Matching it now
means an eventual migration is a rename.

**Our unfair advantage:** `terminology-data.ts` is 848 lines mapping domain vocabulary to meaning —
that a "charge" is not a bank charge, that `byOwners` and `byBusinesses` ask opposite questions,
that ledger slot 2 is the VAT split. That is precisely the intent → schema-coordinate corpus a
search index wants, and no OSS option has anything like it. Indexing the glossary alongside the SDL
is the single highest-leverage thing in this whole proposal.

---

## 4. Self-implementation

Four pieces. Roughly 1,000–1,400 lines of source plus tests, in a package where one curated tool
costs 300–600 — so about the price of three more curated tools, in exchange for retiring the
marginal cost of all future ones. Payback lands somewhere around the fourth tool not written.

### (a) The subset definition — a checked-in file, not an env var

`MCP_TOOL_ALLOWLIST` is an operator knob for switching off what has already shipped. The schema
subset is a product decision that needs a review trail. Keeping them separate means a deploy cannot
silently widen the exposed schema.

Two mechanisms, both viable:

1. **An explicit allowlist module** — verbose, but a diff shows exactly what got exposed. Give it a
   type generated from the schema so an entry naming a field that no longer exists fails the build
   rather than silently narrowing the subset.
2. **Directives in the server's typeDefs** (`@mcp`, à la Hive's `@mcpTool` or federation `@tag` +
   contracts) — no duplication, marker sits next to the field, but it puts MCP concerns in the
   server schema and makes widening a one-token change buried in an unrelated PR.

Recommend (1) while the point is _building_ confidence, and revisit (2) once the subset stops
changing weekly.

### (b) The subset builder — `filterSchema` + `pruneSchema`

`@graphql-tools/utils` is already a `server` dependency (12.0.1) and exposes exactly the primitives
needed: `filterSchema` with `rootFieldFilter`, `typeFilter`, `fieldFilter`, `objectFieldFilter`,
`interfaceFieldFilter`, `inputObjectFieldFilter` and `argumentFilter`, then `pruneSchema` to drop
types left orphaned by the filter.

Run it at **build time**, not per request: `yarn generate` already emits `schema.graphql`, so the
filtered SDL becomes a second build artifact. Runtime cost is zero, and — more usefully — the
printed subset can be snapshotted in a test so widening the surface shows up as a reviewable diff.
`schema-contract.test.ts` is the precedent for that pattern in this package.

~150–250 lines plus tests.

### (c) The execution tool — `accounter_graphql_query`

Most of it already exists. `context.client.query()` refuses non-reads; `context.upstream` already
carries the correlation id, `Authorization` and `x-business-scope`; `shapeDetailResult()` already
enforces the 60 KB budget. What has to be added is the part the curated tools got for free by being
hand-written:

- **Validate against the subset schema, not the full one.** `validate(subsetSchema, parse(doc))`
  before anything leaves the process. This is the enforcement point. The filtered SDL is
  documentation; the validation call is the control. Build both from the same artifact or they will
  drift.
- **Depth, selection-count and alias-count limits.** The server has none (§1). These belong in the
  same change, not a follow-up.
- **Reject `__schema` and `__type`**, or the subset is escapable by introspection.
- **Require an explicit `limit`** on the five root fields that default to `999999`.
- **Replace the read-only regex with an AST check** on `OperationDefinition.operation` — see §5.4.

~250–400 lines plus tests, most of it guards.

### (d) The discovery tools — two, following the `__search` / `__definitions` split

- `accounter_search_schema(intent: string)` → ranked schema coordinates, each with a path from
  `Query` and a one-line reason. Lexical index over type names, field names, descriptions **and the
  glossary**. Stem, lowercase, boost short paths from the root — Apollo's recipe.
- `accounter_describe_schema(coordinates: [String!]!)` → tree-shaken SDL for those coordinates:
  input types expanded fully, output types to a bounded depth.

There is no TS equivalent of Apollo's `SchemaTreeShaker`, so that gets written here. It is a graph
reachability walk over `graphql-js`, not research.

~300–500 lines plus tests.

### What this does _not_ save

- **Output shaping.** Curated tools return flattened, renamed, unit-normalized rows. Raw GraphQL
  returns raw GraphQL. Spec §9.2 ("return only fields needed", "normalize timestamps, currency
  formatting") stops being enforced by code and becomes the model's problem.
- **Per-tool `dataClassification`.** One classification covers the whole surface, and it has to be
  the maximum of anything reachable through it.
- **Semantic guardrails.** `charge-filters.ts` is 314 lines because the model gets `byOwners` versus
  `byBusinesses` wrong. A raw schema surface re-opens every one of those.

---

## 5. Feedback on the idea

### What is right

The marginal cost of a curated tool _is_ the real bottleneck — 7,245 lines bought 17 tools against
108 `Query` root fields, and each new one is a fresh 300–600 lines. Whitelist-first is the correct
default and matches every project that did this well. And requirement 3 is the strongest part of the
proposal: it has the clearest external validation, and it is the only part that pays off **even if
the execution tool never ships** — a search tool over the glossary and the curated-tool catalog
makes the existing 17 tools easier for a model to route between.

### What it lacks, and the blindspots

**5.1 The schema documents its nouns and not its verbs.** Requirement 2 says "using the schema's
descriptions … and exposing them", so the automation inherits the schema's documentation quality
exactly. Measured: all 398 named types have a description, but only **16 of 108 `Query` root
fields** (15%), 228 of 2,021 output fields (11%), 116 of 1,293 input fields (9%) and **9 of 373
field arguments** (2%) do. Some of the type descriptions that do exist are `" mock "`.

That distribution is the worst possible one for this use case. A model reading the subset does not
need to be told what a `Charge` is — the name carries it. It needs to be told which of two
similarly-named root fields to call and what to put in their arguments, and that is where the
descriptions are missing almost entirely. This is the single biggest gap in the proposal, and it
converts it from "write a tool" into "write a tool **and document the subset it exposes**".

The mitigating news: the work is bounded by the subset, not by the schema. Documenting 15 root
fields, their arguments and 40 types is a day of writing, not a quarter — and unlike prose in a
curated tool's `description`, it improves the GraphQL API for human consumers too. Make it a gate: a
coordinate cannot enter the subset until it has a description, enforced by the same build step that
validates the allowlist (§4a).

**5.2 Descriptions are the only channel that reaches the model — and definitions are deferred.**
This repository already measured it (`connector-gaps-and-decisions.md`, 2026-08-27): Claude Desktop
shows the model neither `outputSchema` nor `structuredContent`, and until the model chooses to load
a definition it sees roughly the first sentence of the description. An auto-generated tool whose
value lives in a rich `inputSchema` is betting against a measurement we already took. Design around
it: make the **discovery tool's output** the channel that carries schema detail, never the tool
definition.

**5.3 There is no query-cost control anywhere in the stack.** Covered in §1 and §4c, repeated here
because it is the one that turns into an incident. Today the shape of every query is bounded by a
human having written it. Ship the limits in the same change as the tool.

**5.4 Read-only is enforced by a regex.** `/\b(mutation|subscription)\b/i` over the raw document
text is fine while every document is ours. It becomes load-bearing security the moment a model
writes them — and it _over_-rejects too (a field named `mutationCount`, a string literal containing
the word), which is a correctness bug once callers are arbitrary. Swap in an AST check on
`OperationDefinition.operation` for the generic path.

**5.5 The subset is not the security boundary — and describing it as one will eventually be wrong.**
RLS and the 410 auth directives upstream are the boundary, and they apply to a model-written
document exactly as they do to a curated one. This is the strongest argument for reversing spec
§8.3, and it should be stated explicitly when doing so. But the corollary is just as important: the
subset is a **context-and-blast-radius control**, not an authorization control. The first time
someone adds a field to the subset "because MCP needs it" and treats that as the access decision,
the boundary has moved somewhere nobody is reviewing.

**5.6 Audit and telemetry granularity collapses.** Every call becomes
`tool=accounter_graphql_query`. The usage log, the bounded label counters in `/metrics`, and
per-tool rate limiting all key on tool name. Fix it deliberately and cheaply: derive the operation's
root field names from the AST — they are low-cardinality and carry no customer data — and log and
rate-limit on those.

**5.7 "No further code needed" is not quite true, and the residue is the interesting part.**
Anything the model cannot infer from SDL still needs a home: that `charges` wants `byOwners` and not
`byBusinesses`, that ledger slot 2 is the VAT split, that INTERNAL and CONVERSION charges must not
be summed into a spend total. That is `terminology-data.ts`, and no amount of schema automation
generates it. The honest framing of requirement 2 is: **automation removes the plumbing, not the
domain prose** — which is still a good trade, because the plumbing is most of the 7,245 lines.

**5.8 Mutations are unaddressed.** Read as deliberate, but worth stating: the write path
(`MCP_ENABLE_WRITE_TOOLS`, the exactly-one-business scope rule, pre-execution audit) has invariants
a generic tool would have to reimplement, and "exactly one business" cannot be expressed as a schema
subset at all. Writes should stay curated indefinitely.

**5.9 Two sources of truth for the schema.** The subset derives from `schema.graphql`, which is
git-ignored and regenerated. If the allowlist is a plain list of strings, a renamed field silently
drops out of the subset instead of failing. Make an unknown coordinate a build error, and snapshot
the printed subset SDL.

**5.10 There is no way to tell whether this is working.** Curated tools are correct by construction.
A generic surface is correct by the model's competence, which varies by model version and by
phrasing. "We will extend it gradually as we gain confidence" needs an instrument to measure
confidence with. Before shipping, write ~20 real questions with known-good answers and run them
against both surfaces; re-run on every subset widening. Without that, gradual widening is just
gradual widening.

**5.11 The option the proposal skips.** Requirements 1 and 2 assume the unit of curation is a
_schema subset_ and the model composes queries against it. Every project with real adoption made the
opposite choice: the unit of curation is an _authored operation_, and automation generates the tool
from it. `graphql-codegen-mcp-tools` and `@graphql-hive/plugin-mcp` both do exactly that from a
one-line `@mcpTool` directive; Apollo does it from persisted-query manifests.

That variant satisfies requirement 2 just as well — the input schema, descriptions and types are all
derived, no per-tool code — while keeping the properties a subset gives up: cost, depth, shape and
returned fields are all fixed at build time, so §5.3, §5.6 and most of §4c evaporate. What it gives
up is the thing requirement 1 is actually reaching for: the model cannot ask a question nobody
anticipated.

Both are defensible. But the choice between them is the central decision here and the proposal
doesn't name it, so it should be made explicitly rather than by default. A reasonable synthesis:
operations-as-tools for anything a user asks more than occasionally, and a subset-scoped execution
tool for the long tail — which is also the phasing in §6, with D deferred until A–C show whether the
long tail is real.

### How to improve it

- **Ship requirement 3 first, alone, against the curated tools.** A search tool over the glossary
  plus the existing tool catalog is useful today, carries none of the execution tool's risk, and
  exercises the one thing in the plan whose quality is genuinely uncertain: the ranking.
- **Return coordinates and a path from `Query`, not prose.** Match `__search` / `__definitions`.
- **Two steps, always.** Never put SDL in a tool description. Search returns coordinates; describe
  returns tree-shaken SDL; execute validates against the subset.
- **Validate, do not merely document.** The filtered SDL is what you show; `validate()` against the
  same artifact is what you enforce.
- **Skip minification for now.** Apollo measures ~40%, but on a subset this small that is a rounding
  error, and `T:User:id:d!,name:s` is a notation the model has never seen. Revisit when the subset
  is large enough to hurt.
- **Add an `explain` / dry-run mode** that validates and reports estimated cost without executing.
  It turns the model's first-attempt failure loop from a network round trip into a local one.
- **Keep the curated tools.** The end state is not replacement: curated tools for the top ~10
  workflows, correct by construction and cheap to call, plus a generic surface for the long tail.
  Apollo's own guidance says the same — predefined operations for high-frequency and access-
  controlled paths, search for flexibility.
- **Amend `spec.md` §3.2, §8.3 and §15 and `implementation-blueprint.md` in the same PR.**

---

## 6. Suggested phasing

| Phase | Scope                                                                                                                                                      | Risk    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| A     | `accounter_search_schema` over the glossary + curated tool catalog. No schema exposure yet.                                                                | none    |
| B     | Subset builder + snapshot test + documentation pass over the chosen subset (§5.1)                                                                          | none    |
| C     | `accounter_describe_schema` serving the subset SDL                                                                                                         | low     |
| D     | `accounter_graphql_query` behind a new default-off flag, with validation, depth/cost limits, AST read-only check, root-field-level audit and rate limiting | medium  |
| E     | Eval set (§5.10), then widen the subset on evidence                                                                                                        | ongoing |

Phases A–C are independently useful and carry no new exposure. D is the one that needs the spec
amendment and the limits.

---

## Sources

- [Apollo MCP Server](https://github.com/apollographql/apollo-mcp-server) ·
  [Smart Schema Discovery](https://www.apollographql.com/blog/smart-schema-discovery-how-apollo-mcp-server-maximizes-ai-context-efficiency)
  ·
  [Introspection and Search internals](https://deepwiki.com/apollographql/apollo-mcp-server/3.6-introspection-and-search)
- [ChilliCream — Semantic Introspection RFC](https://chillicream.com/blog/2026/04/22/semantic-introspection/)
- [`@graphql-hive/plugin-mcp`](https://www.npmjs.com/package/@graphql-hive/plugin-mcp) ·
  [Hive Gateway MCP docs](https://the-guild.dev/graphql/hive/docs/gateway/mcp)
- [Lab Digital — Generating MCP tools from GraphQL schemas](https://www.labdigital.nl/blog/generating-mcp-tools-from-graphql-schemas)
- [`graphql-mcp` (C#/Java)](https://github.com/graphql-mcp/graphql-mcp) ·
  [`mcp-graphql`](https://github.com/blurrah/mcp-graphql) ·
  [`mcp-graphql-schema`](https://github.com/hannesj/mcp-graphql-schema)
- [`@graphql-tools/utils` — `filterSchema` / `pruneSchema`](https://the-guild.dev/graphql/tools/docs/api/modules/utils_src#filterschema)
  · [stitching filter transforms](https://the-guild.dev/graphql/stitching/docs/transforms/filtering)
