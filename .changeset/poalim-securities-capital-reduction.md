---
'@accounter/modern-poalim-scraper': patch
'@accounter/scraper-app': patch
'@accounter/server': patch
---

Poalim securities transactions with the `איחוד/הפחתת הון` (consolidation / capital reduction)
payment type no longer fail schema validation. The value is accepted by the scraper schemas and
exposed in GraphQL as the new `SecurityPaymentType.CONSOLIDATION_OR_CAPITAL_REDUCTION` member.
