---
'@accounter/server': patch
---

Refactors Row-Level Security (RLS) testing infrastructure by extracting shared role-management utilities into a reusable helper module, and adds comprehensive integration tests for the read-side (USING clause) of the tenant_isolation policy.
