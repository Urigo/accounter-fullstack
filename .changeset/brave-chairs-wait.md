---
'@accounter/server': patch
---

- **Performance Optimization**: Introduced DataLoader for batching and caching requests to the Green
  Invoice API for both documents and clients, significantly reducing redundant API calls.
- **Caching Implementation**: Implemented a caching layer for Green Invoice API responses, improving
  response times and overall system efficiency.
- **Document Status Update Fix**: Fixed an issue with document status updates by ensuring that
  document data is invalidated from the cache when a document is closed, preventing stale data from
  being served.
- **API Call Refactoring**: Refactored various parts of the codebase to utilize the newly introduced
  DataLoader and caching mechanisms, streamlining interactions with the Green Invoice API.
