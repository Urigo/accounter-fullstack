---
'@accounter/server': patch
---

- **Test Suite Split**: The project's test suite has been formally split into distinct 'unit' and
  'integration' test projects using Vitest, enhancing organization and execution efficiency.
- **New Test Commands**: New `yarn` commands have been introduced: `yarn test` for unit tests,
  `yarn test:integration` for both unit and integration tests, and `yarn test:all` for running all
  suites.
- **Updated Documentation**: Both the root `README.md` and `packages/server/README.md` have been
  updated with comprehensive documentation on the new test suite structure, how to run tests, and
  prerequisites for integration tests.
