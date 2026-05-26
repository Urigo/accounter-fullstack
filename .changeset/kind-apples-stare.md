---
'@accounter/server': patch
---

- **Multi-Business Tenancy Foundation**: Implemented a foundational shift from a single-business
  model to a request-level business scope model, enabling multi-business reads while maintaining
  strict single-business write targeting.
- **Auth Context & Scope Resolution**: Updated authentication providers to resolve all user
  memberships and introduced a `ScopeProvider` to handle read-scope precedence (args ⊆ header ⊆
  memberships) and write-target validation.
- **Database RLS Migration**: Added `app.current_business_scope` session variables and updated RLS
  policies to support multi-business reads via `ANY` predicates, while keeping write operations
  pinned to a single business.
- **GraphQL Contract Hard-Cut**: Replaced the legacy `adminBusinessId` field in `userContext` with a
  robust `memberships` and `activeReadScope` structure, requiring a hard-cut migration of
  server-side consumers.
- **Module Migrations & Guardrails**: Migrated high-traffic modules (charges, reports, ledger,
  salaries) to use the new scope helper and added a repository-wide lint guard to prevent future
  regressions to single-business admin context fallbacks.
