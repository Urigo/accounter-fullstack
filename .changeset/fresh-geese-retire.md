---
'@accounter/client': patch
---

- **Multi-Business Tenancy Foundation**: Implemented a foundational shift from a single-business
  model to a request-level business scope model, enabling multi-business reads while maintaining
  strict single-business write targeting.
- **GraphQL Contract Hard-Cut**: Replaced the legacy `adminBusinessId` field in `userContext` with a
  robust `memberships` and `activeReadScope` structure, requiring a hard-cut migration of
  server-side consumers.
