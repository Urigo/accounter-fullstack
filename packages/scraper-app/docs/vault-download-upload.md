# Vault File Download & Upload

## Overview

Allow users to download their vault file as a backup and upload an existing vault file as an
alternative to creating a new one. Also adds an editable vault path setting so the server can
store and move the vault file to a user-defined location.

---

## Server Changes

### New endpoints in `vault-routes.ts`

**`GET /api/vault/download`**
- Streams the raw encrypted vault file as a binary download.
- No auth required — the file is already encrypted; possessing it is useless without the password.
- Sets `Content-Disposition: attachment; filename=".vault"` and `Content-Type: application/octet-stream`.
- Returns 404 if no vault file exists.

**`POST /api/vault/upload`**
- Accepts a multipart file upload and writes it to the vault path (atomic write via temp file + rename).
- Does NOT attempt to unlock; the UI prompts for a password after upload.
- Returns 409 if a vault already exists. UI shows a "Replace existing vault?" confirm, then re-POSTs with `?force=true`.
- Locks the in-memory vault after a successful upload.

**`GET /api/vault/env-path`**
- Returns the `VAULT_PATH` env var value (or default `.vault`).
- No auth required; used as a hint for the download filename suggestion.
- Separate from `/api/vault/path` (which requires unlock and returns the resolved in-use path).

### `vault.ts`

- Add `vaultPath` as an optional string field to `SettingsSchema`.
- Update `getVaultPath()` priority: `settings.vaultPath` (in-memory vault) → `VAULT_PATH` env → `.vault` default.

### `vault-store.ts`

- Add `let _vaultPath: string` module-level variable, set on unlock and updated when `vaultPath` setting changes.
- When `settings.vaultPath` is saved via `PUT /api/vault/settings`, move the vault file from the old path to the new path using `fs.rename`.

---

## UI Changes

### `api.ts`

New functions:
- `vaultUpload(file: File): Promise<{ ok: boolean }>` — posts file as `multipart/form-data` to `/api/vault/upload`.
- `vaultDownload(): Promise<void>` — fetches `/api/vault/download` as a blob and triggers an `<a download>` click.
- `getEnvVaultPath(): Promise<{ path: string }>` — fetches `/api/vault/env-path`.

### `vault-context.tsx`

- Add `upload(file: File): Promise<void>` to `VaultContextValue`.
- After a successful upload, set status to `'locked'` so the unlock form appears for the newly uploaded vault.

### `vault-unlock.tsx` (vault file exists)

Add an upload section below the password form:

```
[Unlock Vault]
  password: [________]  [Unlock]

  ── or upload a different vault ──
  [Choose file…]
```

When a file is selected → `vault.upload(file)` → on success, context sets status to `'locked'` → same screen re-renders ready for the new vault's password.

### `vault-setup.tsx` (no vault file)

Add an upload alternative above the create flow:

```
[Setup Vault]

  ── Upload an existing vault ──
  [Choose file…]

  ── or create a new one ──
  Step 1: …
```

When file is selected → upload → context transitions to `'locked'` → `VaultUnlock` renders.

### `settings-tab.tsx`

In the "Vault file" fieldset:
1. Change the vault path display from `readOnly` to an editable text input with an `onBlur` handler that calls `saveSettings({ vaultPath: value })`.
2. Add a **Download vault** button: calls `vaultDownload()`. The `download` attribute on the generated `<a>` tag is set to the basename of the saved vault path (or `.vault` as fallback). The browser's native save dialog uses this as the suggested filename; the directory cannot be pre-filled via the browser API.
3. Keep the existing "Copy path" button.

---

## Upload Conflict Flow

1. Server returns 409 when vault already exists.
2. UI shows a confirmation prompt: "A vault already exists. Replace it?"
3. On confirm, UI re-POSTs with `?force=true`.
4. Server overwrites and locks the in-memory vault.

---

## Tests

| File | What to add |
|---|---|
| `vault-routes.test.ts` | `GET /api/vault/download`, `POST /api/vault/upload`, `GET /api/vault/env-path` |
| `vault-unlock.test.tsx` | File input appears; upload triggers status transition to `'locked'` |
| `vault-setup.test.tsx` | Upload alternative renders; selecting file triggers upload |
| `settings-tab.test.tsx` | Vault path input is editable; download button triggers download |
