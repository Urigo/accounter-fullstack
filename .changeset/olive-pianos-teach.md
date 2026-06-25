---
'@accounter/server': patch
---

- **VAT extraction**: adds `issuerVatNumber` / `recipientVatNumber` to the Claude extraction schema
  so VAT/registration numbers are pulled from the document in the same LLM call (near-zero extra
  cost).
- **Server-side matching**: new pure helper `business-matcher.helper.ts` resolves extracted
  names/VAT numbers to business UUIDs in three priority tiers: (1) VAT exact match, (2)
  name/Hebrew-name substring, (3) `suggestion_data.phrases` sorted by priority.
- **LLM fallback**: for financial document types (INVOICE, RECEIPT, INVOICE_RECEIPT, CREDIT_INVOICE,
  PROFORMA) where one or both sides remain unmatched after server-side matching, a second LLM call
  reuses the existing conversation context — no file re-send — and asks Claude to pick the closest
  business from the full businesses list.
- **UUID-based side resolution**: `getDocumentFromFile` now resolves `isOwnerIssuer` and
  `counterpartyId` from the UUID matches, replacing the previous hardcoded `"the guild"` text check.
- **Graceful fallback**: `fetchBusinessesForMatching` wraps the `BusinessesProvider` call in
  try/catch, so email-ingestion paths (gateway auth, no tenant context) continue to work unchanged.
