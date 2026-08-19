---
'@accounter/mcp-server': patch
---

Give the write tools an `observe` hook, so their usage log line says what they did.

The usage logging added in #4244 enriches a call's `tool_call` line from two sources: the shared
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
