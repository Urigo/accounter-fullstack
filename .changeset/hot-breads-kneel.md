---
'@accounter/client': patch
---

- **Feature Removal**: The entire 'Match Document' feature, including its UI components, state
  management, and associated logic, has been completely removed from the client application.
- **Codebase Cleanup**: Several files and components related to the legacy document matching system,
  such as `DocumentsToChargeMatcher`, `SelectionHandler`, and `MatchDocumentModal`, have been
  deleted.
- **Dependency Reduction**: Imports and props related to the removed feature have been cleaned up
  across various components, simplifying their interfaces and reducing dependencies.
