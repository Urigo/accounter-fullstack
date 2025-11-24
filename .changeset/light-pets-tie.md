---
'@accounter/server': patch
---

- **Test Data and Integration Testing**: This pull request introduces reusable demo/staging data and
  an integration testing framework for the `@accounter/server` package, focusing on foundational
  admin context, expense charge scenarios, and ledger generation.
- **Architectural Improvements**: Key improvements include a modular test harness, exact schema
  version enforcement, diagnostics & observability, transactional seeding, environment isolation,
  and a CI workflow.
- **Documentation**: Extensive documentation has been added, including JSDoc examples, idempotency
  semantics, security warnings, and thread safety considerations.
