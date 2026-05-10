---
'@accounter/scraper-app': patch
---

- **New Vault API Endpoints**: Added GET /api/vault/env-path, GET /api/vault/download, and POST
  /api/vault/upload to support vault file management, including atomic writes and binary streaming.
- **Vault Path Configuration**: Introduced a configurable vaultPath in SettingsSchema, allowing
  users to specify and update the storage location of their vault file.
- **Atomic Vault Migration**: Implemented moveVaultFile in the server store to atomically relocate
  the vault file on disk when the vaultPath setting is updated.
- **UI Integration**: Added file upload functionality to both the setup and unlock screens, and
  enabled vault downloading and path editing in the settings tab.
