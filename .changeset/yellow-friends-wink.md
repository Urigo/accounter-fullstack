---
'@accounter/server': patch
---

- **Centralized Temporary Fallback**: A temporary fallback mechanism has been introduced directly
  into the `TenantAwareDBClient` to use legacy authentication (`context.currentUser?.userId`) when
  `authContext` is not yet available during the migration phase.
- **Simplified Provider Migration**: Providers can now directly inject `TenantAwareDBClient` without
  needing to implement their own intermediate RLS workaround code, streamlining the migration
  process.
- **Streamlined Cleanup**: The future cleanup process for temporary RLS logic is simplified, as it
  is now centralized within `TenantAwareDBClient` rather than being scattered across multiple
  provider files.
- **ChargesProvider Update**: The `ChargesProvider` has been updated to directly inject
  `TenantAwareDBClient`, removing its previous temporary RLS client setup.
- **Removal of Old Helper**: The `getRlsDbClient` helper function and the `rlsContextPlugin` have
  been removed as they are no longer required with the new strategy.
- **New DB Cleanup Plugin**: A new `dbCleanupPlugin` has been introduced to manage the disposal of
  `TenantAwareDBClient` instances, ensuring proper resource management and preventing connection
  leaks.
