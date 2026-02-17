---
'@accounter/server': patch
---

- **Asynchronous Cache Operations**: Modified the `updateContract` and `deleteContract` methods to
  explicitly `await` calls to `this.clearCache()` and `this.invalidateCacheForContract()`, ensuring
  these asynchronous cache operations complete before subsequent logic.
