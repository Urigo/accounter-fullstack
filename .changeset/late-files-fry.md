---
'@accounter/server': patch
---

- **Super-Admin Infrastructure**: Introduced a `super_admins` database table and associated RLS
  policies to manage platform-level administrative privileges, preventing unauthorized
  self-promotion.
- **Client Onboarding**: Implemented the `bootstrapNewClient` GraphQL mutation, enabling the
  automated, transactional provisioning of new client tenants, including business entities, tax
  categories, and user contexts.
- **Security & RLS Enhancements**: Refined Row-Level Security (RLS) policies to support the
  bootstrap flow, including a root-level insert policy and read-only access for super-admin
  verification.
- **Code Refactoring**: Moved deterministic UUID generation to a shared utility module and
  introduced `EntityEnsureProvider` to standardize the creation of financial entities across the
  system.
