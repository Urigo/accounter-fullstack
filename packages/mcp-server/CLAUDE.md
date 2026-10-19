# MCP Server Package

Remote MCP server exposing a curated subset of Accounter to Claude clients. Every tool is a thin
wrapper over one upstream GraphQL operation; the value is in the input validation, the result
shaping and the prose the model reads. `README.md` is the long-form reference.

## Layout

- `src/tools/<name>.ts` — one file per tool family; a `ToolDefinition` (zod input, policy, handler,
  `observe`). Write tools end in `-write.ts`.
- `src/tools/registry-instance.ts` — registration order **is** the order the model sees: reads
  first, writes last.
- `src/tools/__tests__/` — per-tool tests plus registry-wide contracts (`scope-forwarding`,
  `usage-log`, `description-contract`, `schema-contract`, `mirroring-contract`,
  `registry-instance`). Every new tool must be added to the fixtures in `scope-forwarding` and
  `usage-log` (`ARGS_BY_TOOL` + the fake upstream's `dataFor`), and every write tool to
  `description-contract`'s write-result table.
- `src/__tests__/mcp-e2e.test.ts` — exposure checks (`WRITE_TOOLS` must list every mutating tool).
- `src/gql/index.ts` — generated from the `/* GraphQL */` documents in `src/tools/**`; run
  `yarn generate` from the repo root after adding or changing one. Fragment types are named
  `<FragmentName>Fragment`, operations `<OperationName>Query` / `<OperationName>Mutation`.

## Before writing a new tool — reuse what exists

Grep `src/tools/` before declaring anything. These already exist and must be imported, not
re-declared:

| Need                                   | Use                                                              |
| -------------------------------------- | ---------------------------------------------------------------- |
| `ChargeType` / `AccountantStatus` list | `charge-filters.ts` (`CHARGE_TYPES`, …)                          |
| `DocumentType` list                    | `document-details.ts` (`DOCUMENT_TYPES`)                         |
| charge `__typename` → `chargeType`     | `entity-shapes.ts` (`chargeTypeFromTypename`) — never a regex    |
| `YYYY-MM-DD` input                     | `dates.ts` (`TIMELESS_DATE` + `parseCalendarDate` for validity)  |
| ISO alpha-3 country                    | `country-codes.ts` (`countryCodeInput`, mirrors the server enum) |
| scope inputs / description suffixes    | `scope-input.ts`                                                 |
| write result envelope                  | `output.ts` (`shapeWriteResult`, `writeResultDescription`)       |
| emptied-charge cleanup after a move    | `charge-cleanup.ts`                                              |

`schema-contract.test.ts` pins the shared lists to `schema.graphql`; a private copy in a tool file
goes stale silently.

## Every claim in a description must be read off the resolver

Tool descriptions and README prose are what the model acts on, so a wrong sentence is a bug, not a
typo. Before describing what an upstream mutation does, read its resolver in
`packages/server/src/modules/<module>/resolvers/` **end to end**, including the branches you are not
calling. Things that have bitten before:

- `UpdateChargeInput.counterpartyId` exists in the schema and is ignored by `updateCharge`; a
  charge's counterparty is derived from its transactions and documents.
- `updateTransactions` / `updateDocument` delete an emptied former charge **only** on the
  `EMPTY_UUID` unlink path; moving onto a real charge leaves the old charge behind.
- `EMPTY_UUID` on `updateTransactions` creates **one** new charge for all listed rows.
- `mergeCharges` returns the base charge as loaded **before** `fields` are applied.
- `updateDocument` takes the document currency from `amount` only; `vat.currency` is ignored.
- `insertNewBusiness` is not transactional (entity first, business row second).
- `CountryCode` is a scalar in the schema but an enum on the server (`shared/enums.ts`).

When a schema input has more fields than the tool exposes, either expose them all (the default: the
Accounter UI does) or say in the tool's doc comment why a field is left out.

## Prose that counts tools

Three places state how many tools there are and go stale on every addition:

- `src/mcp/handler.ts` `MODERN_INSTRUCTIONS` ("plus N opt-in write tools") — the model reads it.
- `src/tools/terminology.ts` header comment ("unlike the other N").
- `README.md` — the tool list, the write-tools table and the "Phase 2" paragraph.

## Write tools

Every mutating tool: `policy.mutating: true` plus `requiredRoles: ['business_owner','accountant']`
and `requiresBusinessScope: true` (pinned by `registry-instance.test.ts`); `memberBusinessId` via
`writeTargetBusinessIdInput`; send only the fields the caller passed (upstream treats absent as
"leave as is" and `null` as "clear"); refuse a no-op before any round trip with `ToolInputError`;
map a `CommonError` member to a non-retryable `UpstreamError`; a GraphQL document on the write path
must **start** with `mutation` (put fragments after the operation). A write may do reads around its
mutation (`context.client.query`) — a pre-read to capture state, a re-read when the mutation's own
return value is stale — but exactly one mutation per `mutate()` call.

## Before opening a PR

1. `yarn generate`, `tsc --noEmit`, `eslint`, `prettier --check`, `vitest run` in this package.
2. Add a changeset under `.changeset/` (`'@accounter/mcp-server': minor|patch`).
3. Re-read every description you wrote against the resolver it describes (the list above is the kind
   of thing a reviewer running an adversarial pass over the diff will find).
