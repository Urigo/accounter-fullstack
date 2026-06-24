---
'@accounter/server': patch
---

- **OCR at ingest time**: `prepareDocuments` now calls `getOcrData` to classify documents via
  Anthropic, matching the legacy upload path.
- **Remarks override**: Email ingestion documents now override the OCR-derived remarks with an email
  identifier (`email-ingestion: {messageId}`), consistent with the legacy resolver.
- **Test coverage**: Updated tests to mock `AnthropicProvider.extractInvoiceDetails` and verify that
  documents are classified (INVOICE) rather than UNPROCESSED, and that the recognized business is
  attributed as the creditor.
