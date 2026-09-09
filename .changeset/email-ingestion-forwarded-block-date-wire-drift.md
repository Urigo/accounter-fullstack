---
'@accounter/email-ingestion-gateway': patch
---

Stop sending `senderEvidence.forwardedBlocks[].date`, which the server schema has never accepted,
and stop a gateway rejection from becoming an unbounded Cloudflare redelivery loop.

Every forwarded supplier invoice whose quoted `---------- Forwarded message ---------` block carried
a `Date:` line failed ingestion:

```
HTTP 400: Variable "$input" got invalid value … at "input.senderEvidence.forwardedBlocks[0]";
Field "date" is not defined by type "ForwardedBlockInput".
```

`forwarded.ts` has parsed a `date` off each quoted block since the file was written, and the same
commit added `ForwardedBlockInput` to the server typeDefs with four fields and no `date`. The
classifier only ever reads `from`, `fromDisplayName` and the block count, so the field was dead
weight that the schema then rejected. Only blocks with an actual `Date:` line tripped it —
`headers.get('date') || undefined` plus `JSON.stringify` dropping undefined keys made the rest pass.

**Why TypeScript could not see it.** `webhook.ts` declared `let senderEvidence:
ControlSenderEvidence` and assigned the extractor's `SenderEvidence` into it. Excess-property
checking fires only on fresh object literals, so a wider type flowing into a narrower slot was
accepted silently. `server-client.ts` hand-wrote `ControlForwardedBlock` / `ControlSenderEvidence` /
`ControlInput` as duplicates of the generated `ForwardedBlockInput` / `SenderEvidenceInput` /
`IngestControlInput` — strict subsets, hence assignable — and `Exact<>` on the mutation variables
pins only the top level, so nothing nested was ever freshness-checked.

Those three types are now **derived** from `src/gql/`, and everything crossing to the wire goes
through `toControlSenderEvidence`, an annotated projection: a return-position object literal with a
declared return type *is* freshness-checked, so naming a field the SDL lacks stops compiling. A pair
of `AssertNever` assertions additionally fail the build when `ForwardedBlock` or `SenderEvidence`
grows a field that is neither in the schema nor listed as deliberately not sent. `server-tests.yml`
now typechecks the package, which nothing in CI did before.

**The redelivery loop.** Cloudflare Email Routing treats an unhandled exception from `email()` as a
temporary delivery failure and redelivers with growing backoff, so the 503 that this 400 produced
put three messages through 4-5 redeliveries across 12 hours. `worker.ts` already forwards every
message to `EMAIL_FORWARD_DESTINATION` before calling the webhook, so a later rejection is a lost
*ingestion*, not a lost *email*. The handler now throws only when **no copy of the message was
delivered at all**; the fallback forward is skipped when `FALLBACK_EMAIL` is unset or equal to
`EMAIL_FORWARD_DESTINATION` (the runtime rejects a second forward to an address already used for the
message), and a failing fallback forward no longer escalates. The health probe is bounded, since an
unbounded one outliving the Worker's wall clock is a loop source of its own. Every branch emits a
structured `worker:*` line, including which env vars are actually bound.

**Guards.** A new `wire-contract.test.ts` runs all eight committed `.eml` fixtures through the real
extractor and coerces the resulting variables against the server SDL with `graphql`'s own
`coerceInputValue` — the very function that produced the production error — so the input-shape half
of the wire contract is now covered, where `contracts.ts` parity only ever guarded the outcome and
reason-code constants. Against the unfixed code it fails on the four `forwarded-*` fixtures with the
production error text verbatim.

`EMAIL_FORWARD_DESTINATION` was documented nowhere; it is now in the README env table,
`.dev.vars.example` and the Cloudflare runbook, along with the fact that `wrangler deploy` deletes
dashboard plain-text variables while preserving secrets. The runbook's inlined copy of the Worker
source — which had drifted from the real handler — is replaced by a pointer to it.
