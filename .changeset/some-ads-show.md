---
'@accounter/server': patch
---

- Introduced client-aware date confidence scoring with gentle mode for eligible scenarios
- Converted matching functions to async to support DataLoader-based client and status lookups
- Consolidated DocumentType usage from database string literals to shared enums
- Added PROFORMA to accounting document types to enable gentle scoring eligibility
