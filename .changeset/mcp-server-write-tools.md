---
'@accounter/mcp-server': patch
---

First write ("edit") tools for the MCP connector, behind an opt-in flag.

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

- `accounter_upload_documents` — attaches 1–10 base64-encoded documents to an **existing** charge.
  `chargeId` is required: upstream `batchUploadDocuments` creates a new charge when it is omitted,
  which is not a side effect the model should trigger by leaving a field blank. `isSensitive` is
  pinned to `true` and deliberately absent from the input schema. Documents arrive as base64 because
  this server is remote and has no access to the caller's filesystem; each is validated for encoding,
  MIME type, and size (256KB per file, 512KB per call, decoded) *before* anything is uploaded —
  `Buffer.from(x, 'base64')` silently skips characters it does not recognize, so a truncated payload
  would otherwise decode to a plausible-looking short buffer and surface as a corrupt file much
  later. Upstream returns one result per file, so partial failure is reported positionally rather
  than collapsed.
- `accounter_update_charges_tags` — adds and/or removes tags across 1–50 charges. Tags are given by
  id, never by name: names are not unique across owners, so resolving them here would mean guessing
  which of several same-named tags was meant — the model resolves them with `accounter_list_tags`
  first. The edit is incremental, not a replacement, and removals run before additions, so a tag id
  passed in both lists ends up added.

The upload caps are small because inline base64 makes the *model* the transport — it must emit the
whole encoded file as tool arguments, and base64 tokenizes at roughly 3 characters per token, so a
277KB PDF costs on the order of 100k output tokens. They are also pinned against
`MAX_MCP_BODY_BYTES` by `tools/__tests__/upload-limits.test.ts`, because an earlier draft advertised
5MB per file while the 1MB body cap made that unreachable. Over-size errors name the Drive and email
ingestion paths rather than just reporting a number: without that, the model's natural move is to
re-encode a scanned receipt at lower quality until it fits, archiving a degraded copy of a legal
financial record.

Known gaps, filed as I6/I7 in `docs/todo.md`: writes carry no idempotency key (the server never
retries, but a client retrying an upload whose result it never saw can duplicate the document), and
the accountant-approval degradation that `batchUploadDocuments` performs upstream is not reflected in
the tool's response.
