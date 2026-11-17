---
'@accounter/server': patch
---

Every server log line written while handling a request now carries that request's `requestId`,
`correlationId`, `operationName`, `userId` and `businessId` (when known), from an
`AsyncLocalStorage` store opened per HTTP request. No call-site changes.
