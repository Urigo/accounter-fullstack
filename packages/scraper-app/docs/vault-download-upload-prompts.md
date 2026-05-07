# Vault Download & Upload — Implementation Prompts

Reference plan: [`vault-download-upload.md`](./vault-download-upload.md)

These prompts are ordered so each one compiles and passes tests before the next begins. No step
leaves orphaned code. Each prompt is self-contained — paste it verbatim into the LLM.

---

## Blueprint

```
Step 1  — Server: GET /api/vault/env-path  (trivial, no auth, safe foundation)
Step 2  — Server: GET /api/vault/download  (stream file, no auth)
Step 3  — Server: POST /api/vault/upload   (write file, lock vault, 409/force)
Step 4  — vault.ts: add vaultPath to SettingsSchema
Step 5  — vault-store.ts: _vaultPath cache + move-on-save
Step 6  — settings-routes.ts: wire path-move into PUT /api/vault/settings
Step 7  — UI api.ts: vaultUpload, vaultDownload, getEnvVaultPath
Step 8  — vault-context.tsx: add upload()
Step 9  — VaultUnlock: upload-a-different-vault section
Step 10 — VaultSetup: upload-existing-vault alternative
Step 11 — SettingsTab: editable vaultPath + Download button
```

---

## Prompt 1 — Server: `GET /api/vault/env-path`

> **Goal:** Add the simplest new endpoint first — no auth, no file I/O beyond reading an env var.
> This gives us a tested route registration pattern to follow for the harder endpoints.

```
You are working in packages/scraper-app/src/server/.

TASK
Add GET /api/vault/env-path to vault-routes.ts.

BEHAVIOUR
- No authentication required.
- Returns JSON: { path: string } where path is process.env['VAULT_PATH'] ?? '.vault'.
- Register the route inside the existing registerVaultRoutes function, before the closing brace.

TESTS  (add to src/server/__tests__/vault-routes.test.ts)
Add a new describe block: 'GET /api/vault/env-path'
- it 'returns the VAULT_PATH env var when set'
    Set process.env['VAULT_PATH'] = '/tmp/custom.vault' in beforeEach (alongside the existing
    vaultPath override), call the route, expect { path: '/tmp/custom.vault' }.
- it 'returns ".vault" when VAULT_PATH is not set'
    delete process.env['VAULT_PATH'] before the request, expect { path: '.vault' }.

Use the same buildApp / makeTmpPath / afterEach(lockVault + rm + delete env) pattern already in
the file. Ensure afterEach restores process.env['VAULT_PATH'] to whatever buildApp set.

Run: yarn workspace @accounter/scraper-app test --reporter=verbose
All existing tests must still pass.
```

---

## Prompt 2 — Server: `GET /api/vault/download`

> **Goal:** Serve the raw encrypted vault file as a binary download. No auth needed — the blob is
> useless without the password. This is pure file I/O; vault-store is not involved.

```
You are working in packages/scraper-app/src/server/.

TASK
Add GET /api/vault/download to vault-routes.ts.

BEHAVIOUR
- No authentication required.
- Reads the file at getVaultPath() using fs/promises readFile.
- If the file does not exist (ENOENT), return reply.status(404).send({ error: 'no-vault-file' }).
- On success:
    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Content-Disposition', 'attachment; filename=".vault"');
    return reply.send(fileBuffer);   // send the Buffer directly

Do NOT import vault-store or check isLocked(). This endpoint intentionally skips auth.

IMPORTS needed: import { readFile } from 'node:fs/promises';
getVaultPath is already imported from './vault.js'.

TESTS  (add to src/server/__tests__/vault-routes.test.ts)
New describe block: 'GET /api/vault/download'

Setup (beforeEach): create a real vault file with saveVaultFile(vaultPath, defaultVault(), PASSWORD)
so the file exists on disk.

- it 'returns 200 with octet-stream content-type when vault file exists'
    inject GET /api/vault/download
    expect statusCode 200
    expect headers['content-type'] to match /application\/octet-stream/
    expect headers['content-disposition'] to equal 'attachment; filename=".vault"'
    expect res.rawPayload to be a non-empty Buffer (res.rawPayload.length > 0)

- it 'returns 404 when no vault file exists'
    Use a separate describe/beforeEach that does NOT create the file.
    inject GET /api/vault/download
    expect statusCode 404
    expect res.json().error to equal 'no-vault-file'

Run: yarn workspace @accounter/scraper-app test --reporter=verbose
```

---

## Prompt 3 — Server: `POST /api/vault/upload`

> **Goal:** Accept a vault file upload, write it atomically, and lock the in-memory vault.
> This is the most complex server step — handle the 409 / `?force` conflict flow here.

```
You are working in packages/scraper-app/src/server/.

TASK
Add POST /api/vault/upload to vault-routes.ts.

BEHAVIOUR
- Accepts a raw binary body (the encrypted vault blob). Content-Type is application/octet-stream.
  Use Fastify's built-in body handling — add the route with:
    { config: { rawBody: false } }
  and read the body as req.body (Fastify exposes it as a Buffer when Content-Type is octet-stream).
- Query param: force (string, optional). Treat any truthy value as "overwrite allowed".
- Logic:
    1. const exists = await hasVaultFile();
    2. If exists && !force → return reply.status(409).send({ error: 'vault-already-exists' });
    3. Write the body to a temp file path (vaultPath + '.tmp') using writeFile.
    4. Rename the temp file to getVaultPath() using rename (from node:fs/promises).
       This is the atomic write — partial writes never replace the live file.
    5. lockVault()  ← always lock after writing so the user must re-unlock.
    6. return reply.status(200).send({ ok: true });
- On any fs error, return reply.status(500).send({ error: 'write-failed' }).

IMPORTS needed:
  import { rename, writeFile } from 'node:fs/promises';
  hasVaultFile and lockVault are already available via vault-store imports.

TESTS  (add to src/server/__tests__/vault-routes.test.ts)
New describe block: 'POST /api/vault/upload'
Use makeTmpPath() for vaultPath. afterEach: lockVault, app.close, rm(vaultPath, { force: true }),
rm(vaultPath + '.tmp', { force: true }).

Helper: async function uploadVault(app, vaultPath, opts = {}) — creates a real vault file in memory
via encryptVault(defaultVault(), PASSWORD) (import from vault.ts), then injects:
  method: 'POST', url: '/api/vault/upload' + (opts.force ? '?force=true' : ''),
  payload: Buffer.from(blob, 'base64'),
  headers: { 'content-type': 'application/octet-stream' }

Tests:
- it 'returns 200 and writes the vault file when no file exists'
    const res = await uploadVault(app, vaultPath)
    expect statusCode 200, res.json() { ok: true }
    const exists = await access(vaultPath).then(()=>true).catch(()=>false)
    expect exists to be true

- it 'returns 409 when vault already exists and force is not set'
    saveVaultFile(vaultPath, defaultVault(), PASSWORD) in beforeEach to pre-create
    const res = await uploadVault(app, vaultPath)
    expect statusCode 409, error 'vault-already-exists'

- it 'overwrites and returns 200 when force=true and vault exists'
    pre-create the file, then uploadVault(app, vaultPath, { force: true })
    expect statusCode 200

- it 'locks the vault after successful upload even if it was unlocked'
    unlock the vault first (POST /api/vault/unlock), confirm isLocked()===false,
    then uploadVault, then inject GET /api/vault/status and expect locked: true

Run: yarn workspace @accounter/scraper-app test --reporter=verbose
```

---

## Prompt 4 — `vault.ts`: add `vaultPath` to `SettingsSchema`

> **Goal:** Persist the vault's own file path inside the encrypted vault, so moving the file is
> a user-controlled setting. Small, isolated schema change — no behavior change yet.

```
You are working in packages/scraper-app/src/server/vault.ts.

TASK
Add an optional vaultPath field to SettingsSchema.

CHANGE
In the SettingsSchema z.object({...}) definition, add:
  vaultPath: z.string().optional(),

That is the only change to vault.ts. Do not change getVaultPath() yet — that comes in the next step.

WHY this ordering: vault-store.ts reads vault.ts types, so the schema must be updated before
vault-store.ts can use the new field.

TESTS  (add to src/server/__tests__/vault.test.ts — check the existing file structure first)
In the existing vault.test.ts, add a case inside whichever describe covers SettingsSchema or
VaultSchema parsing:

- it 'accepts vaultPath in settings'
    const v = VaultSchema.parse({ settings: { vaultPath: '/custom/path/.vault' } })
    expect(v.settings.vaultPath).toBe('/custom/path/.vault')

- it 'accepts settings without vaultPath'
    const v = VaultSchema.parse({ settings: {} })
    expect(v.settings.vaultPath).toBeUndefined()

Run: yarn workspace @accounter/scraper-app test --reporter=verbose
```

---

## Prompt 5 — `vault-store.ts`: `_vaultPath` cache and `moveVaultFile`

> **Goal:** The store must track the resolved vault path independently of the env var so it can
> move the file when the user changes `settings.vaultPath`. Introduce the module-level variable
> and the move helper here — not yet wired into settings-routes.

```
You are working in packages/scraper-app/src/server/vault-store.ts.

TASK
Add a cached _vaultPath variable and a moveVaultFile helper.

CHANGES

1. Add at the top of the module (after existing let declarations):
     let _vaultPath: string | null = null;

2. Export a function getCurrentVaultPath(): string that returns _vaultPath ?? getVaultPath().
   This is now the single source of truth for the active path. Callers that currently call
   getVaultPath() directly should be updated to call getCurrentVaultPath() — but only within
   vault-store.ts itself. (vault-routes.ts still calls getVaultPath() for the env-path endpoint,
   which is correct.)

3. In unlockVault(): after setting _vault and _password, also set:
     _vaultPath = getVaultPath();
   This captures the path at the moment of unlock (env var / default).

4. In lockVault(): also reset _vaultPath = null.

5. Export async function moveVaultFile(newPath: string): Promise<void>
   - If _vault === null || _password === null, throw new Error('Vault is locked').
   - const oldPath = getCurrentVaultPath();
   - if (oldPath === newPath) return;   // no-op
   - await rename(oldPath, newPath);    // from node:fs/promises
   - _vaultPath = newPath;
   Import rename from 'node:fs/promises'.

6. In the existing updateVault() function, replace saveVaultFile(getVaultPath(), ...) with
   saveVaultFile(getCurrentVaultPath(), ...).

TESTS  (add to src/server/__tests__/vault.test.ts or create vault-store.test.ts if none exists)
Use the same makeTmpPath / saveVaultFile / lockVault afterEach pattern from vault-routes.test.ts.

- it 'getCurrentVaultPath returns env default before unlock'
    delete process.env['VAULT_PATH']; const p = getCurrentVaultPath(); expect(p).toBe('.vault')

- it 'getCurrentVaultPath returns the path set at unlock'
    process.env['VAULT_PATH'] = vaultPath; await unlockVault(PASSWORD)
    expect(getCurrentVaultPath()).toBe(vaultPath)

- it 'moveVaultFile moves the file and updates getCurrentVaultPath'
    await unlockVault(PASSWORD) (with existing vault file at vaultPath)
    const newPath = makeTmpPath()
    await moveVaultFile(newPath)
    expect(getCurrentVaultPath()).toBe(newPath)
    const exists = await access(newPath).then(()=>true).catch(()=>false)
    expect(exists).toBe(true)
    cleanup: rm(newPath, { force: true })

- it 'moveVaultFile is a no-op when paths are the same'
    await unlockVault(PASSWORD)
    await expect(moveVaultFile(vaultPath)).resolves.not.toThrow()

- it 'moveVaultFile throws when vault is locked'
    // do not unlock
    await expect(moveVaultFile('/some/path')).rejects.toThrow('Vault is locked')

Run: yarn workspace @accounter/scraper-app test --reporter=verbose
```

---

## Prompt 6 — `settings-routes.ts`: move vault file when `vaultPath` changes

> **Goal:** Wire the `moveVaultFile` helper into the settings `PUT` route so saving a new
> `vaultPath` atomically moves the file on disk. This completes the server-side feature.

```
You are working in packages/scraper-app/src/server/settings-routes.ts.

TASK
When a PUT /api/vault/settings request includes a vaultPath change, move the vault file.

CHANGES

1. Import moveVaultFile and getCurrentVaultPath from './vault-store.js'.

2. In the PUT handler, after validating parsed.data with SettingsSchema.partial().safeParse():
   a. Extract the requested new path:
        const newPath = parsed.data.vaultPath;
   b. If newPath is defined and newPath !== getCurrentVaultPath():
        try { await moveVaultFile(newPath); }
        catch { return reply.status(500).send({ error: 'move-failed' }); }
   c. Then continue with the existing updateVault call.

Order matters: move the file BEFORE updateVault writes the new vault content, so the vault is
always written to the correct (new) location.

TESTS  (add to src/server/__tests__/settings-routes.test.ts)
Check the existing file for the setup pattern. Add a new describe block:

'PUT /api/vault/settings — vaultPath change'

beforeEach: create vault file at vaultPath, unlock vault (POST /api/vault/unlock).
afterEach: lockVault, app.close, rm both paths with { force: true }.

- it 'moves the vault file and returns updated settings when vaultPath changes'
    const newPath = makeTmpPath()
    const res = await app.inject({
      method: 'PUT', url: '/api/vault/settings',
      payload: { vaultPath: newPath }
    })
    expect statusCode 200
    expect res.json().vaultPath to equal newPath
    const oldExists = await access(vaultPath).then(()=>true).catch(()=>false)
    expect(oldExists).toBe(false)
    const newExists = await access(newPath).then(()=>true).catch(()=>false)
    expect(newExists).toBe(true)
    cleanup rm(newPath) in afterEach

- it 'returns 200 without moving anything when vaultPath is not in the payload'
    await app.inject({ method: 'PUT', url: '/api/vault/settings',
      payload: { showBrowser: true } })
    const exists = await access(vaultPath).then(()=>true).catch(()=>false)
    expect(exists).toBe(true)   // original file untouched

Run: yarn workspace @accounter/scraper-app test --reporter=verbose
```

---

## Prompt 7 — UI `api.ts`: `vaultUpload`, `vaultDownload`, `getEnvVaultPath`

> **Goal:** Add the three new client-side API functions. Pure data-layer; no UI yet.
> This step also updates the existing `getVaultPath` to be consistent with the new naming.

```
You are working in packages/scraper-app/src/ui/lib/api.ts.

TASK
Add three new API helper functions.

ADDITIONS (append after the existing getVaultPath function):

export function getEnvVaultPath(): Promise<{ path: string }> {
  return apiFetch('/api/vault/env-path');
}

export async function vaultUpload(file: File, force = false): Promise<{ ok: boolean }> {
  const url = force ? '/api/vault/upload?force=true' : '/api/vault/upload';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ ok: boolean }>;
}

export async function vaultDownload(suggestedName = '.vault'): Promise<void> {
  const res = await fetch('/api/vault/download');
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

No test file currently exists for api.ts. Create
src/ui/__tests__/api.test.ts with @vitest-environment happy-dom:

import { describe, it, expect, vi, afterEach } from 'vitest';
import { vaultUpload, vaultDownload, getEnvVaultPath, ApiError } from '../lib/api.js';

afterEach(() => vi.unstubAllGlobals());

describe('getEnvVaultPath', () => {
  it('returns the path from the server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ path: '/custom/.vault' })
    }));
    const result = await getEnvVaultPath();
    expect(result.path).toBe('/custom/.vault');
  });
});

describe('vaultUpload', () => {
  it('POSTs to /api/vault/upload with octet-stream', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['data'], 'vault');
    await vaultUpload(file);
    expect(fetchMock).toHaveBeenCalledWith('/api/vault/upload', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Content-Type': 'application/octet-stream' }),
    }));
  });

  it('appends ?force=true when force=true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    await vaultUpload(new File(['d'], 'v'), true);
    expect(fetchMock.mock.calls[0][0]).toContain('force=true');
  });

  it('throws ApiError with status 409 on conflict', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 409, json: async () => ({ error: 'vault-already-exists' })
    }));
    await expect(vaultUpload(new File(['d'], 'v'))).rejects.toBeInstanceOf(ApiError);
  });
});

describe('vaultDownload', () => {
  it('creates and clicks a download link', async () => {
    const blob = new Blob(['data']);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => blob }));
    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue(
      Object.assign(document.createElement('a'), { click: clickSpy })
    );
    await vaultDownload('.vault');
    expect(clickSpy).toHaveBeenCalled();
  });
});

Run: yarn workspace @accounter/scraper-app test --reporter=verbose
```

---

## Prompt 8 — `vault-context.tsx`: add `upload()`

> **Goal:** Surface the upload function in the vault context so screens can call it without
> directly importing api.ts. Follows the exact same pattern as `unlock` and `create`.

```
You are working in packages/scraper-app/src/ui/contexts/vault-context.tsx.

TASK
Add upload(file: File, force?: boolean): Promise<void> to the vault context.

CHANGES

1. In the VaultContextValue type, add:
     upload(file: File, force?: boolean): Promise<void>;

2. Import vaultUpload and ApiError from '../lib/api.js'.

3. Inside VaultProvider, add a useCallback for upload:
     const upload = useCallback(async (file: File, force = false) => {
       setError(null);
       try {
         await vaultUpload(file, force);
         setStatus('locked');
       } catch (e) {
         if (e instanceof ApiError && e.status === 409) {
           // Re-throw so the caller can handle the conflict (show confirm dialog)
           throw e;
         }
         setError('Failed to upload vault. Please try again.');
       }
     }, []);

4. Add upload to the VaultContext.Provider value prop.

5. Update the makeCtx helper in src/ui/__tests__/vault-unlock.test.tsx and
   src/ui/__tests__/vault-setup.test.tsx to include upload: vi.fn() so existing tests
   still compile. (The contexts in those files spread overrides, so just add upload to the
   base object in makeCtx.)

TESTS  (add to a new describe block in src/ui/__tests__/vault-unlock.test.tsx
        or create src/ui/__tests__/vault-context.test.tsx)

The simplest approach: add to vault-unlock.test.tsx since it already has the VaultContext
infrastructure.

- it 'calls upload with the file and sets status to locked on success'
    Use a stateful wrapper:
    function UploadWrapper() {
      const [status, setStatus] = useState<VaultStatus>('locked');
      const upload = vi.fn().mockImplementation(async () => setStatus('locked'));
      return (
        <VaultContext.Provider value={{ status, error: null, unlock: vi.fn(), create: vi.fn(), upload }}>
          <VaultUnlock />
        </VaultContext.Provider>
      );
    }
    (VaultUnlock will gain a file input in the next step — this test is a forward stub,
    just verify the context value shape compiles and renders without error for now.)
    render(<UploadWrapper />)
    expect(screen.getByLabelText(/master password/i)).toBeTruthy()

Run: yarn workspace @accounter/scraper-app test --reporter=verbose
```

---

## Prompt 9 — `VaultUnlock`: upload-a-different-vault section

> **Goal:** When the vault exists but the user wants to use a different vault, they can upload it
> from this screen. Handles the 409 conflict with a window.confirm fallback.

```
You are working in packages/scraper-app/src/ui/screens/vault-unlock.tsx.

TASK
Add an "or upload a different vault" file input section below the unlock form.

CURRENT SHAPE: password input + Unlock button.
FINAL SHAPE:
  [Unlock Vault]
  <form> password + Unlock button </form>
  <hr />
  <section> file input "or upload a different vault" </section>

CHANGES

1. Import useRef from 'react'.
2. Import { useVault } from '../contexts/vault-context.js'  (already imported — keep it).
3. Add state: const [uploadError, setUploadError] = useState<string | null>(null);
4. Add a ref: const fileInputRef = useRef<HTMLInputElement>(null);

5. Add handler:
     async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
       const file = e.target.files?.[0];
       if (!file) return;
       setUploadError(null);
       try {
         await vault.upload(file);
       } catch {
         // 409: vault exists, ask to overwrite
         const confirmed = window.confirm(
           'A vault already exists. Replace it with the uploaded file?'
         );
         if (confirmed) {
           try {
             await vault.upload(file, true);
           } catch {
             setUploadError('Failed to replace vault. Please try again.');
           }
         }
       }
       // Reset so the same file can be re-selected
       if (fileInputRef.current) fileInputRef.current.value = '';
     }

6. Below the existing </form>, add:
     <hr />
     <div>
       <p>or upload a different vault</p>
       <input
         ref={fileInputRef}
         id="vault-upload"
         type="file"
         aria-label="Upload vault file"
         onChange={handleFileChange}
       />
       {uploadError && <p role="alert">{uploadError}</p>}
     </div>

TESTS  (add to src/ui/__tests__/vault-unlock.test.tsx)

Update makeCtx to include upload: vi.fn().mockResolvedValue(undefined) in the base object.

New describe block: 'VaultUnlock — file upload'

- it 'renders the upload file input'
    renderUnlock()
    expect(screen.getByLabelText(/upload vault file/i)).toBeTruthy()

- it 'calls vault.upload when a file is selected'
    const upload = vi.fn().mockResolvedValue(undefined)
    renderUnlock(makeCtx({ upload }))
    const input = screen.getByLabelText(/upload vault file/i)
    const file = new File(['blob'], 'test.vault')
    await userEvent.upload(input, file)
    expect(upload).toHaveBeenCalledWith(file)

- it 'shows confirm dialog and calls upload with force=true on 409'
    const ApiError = (await import('../lib/api.js')).ApiError
    const upload = vi.fn()
      .mockRejectedValueOnce(new ApiError(409, 'vault-already-exists'))
      .mockResolvedValueOnce(undefined)
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    renderUnlock(makeCtx({ upload }))
    await userEvent.upload(screen.getByLabelText(/upload vault file/i), new File(['b'], 'v'))
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2))
    expect(upload).toHaveBeenLastCalledWith(expect.any(File), true)
    vi.unstubAllGlobals()

- it 'shows uploadError when force upload also fails'
    const upload = vi.fn().mockRejectedValue(new (await import('../lib/api.js')).ApiError(409, 'x'))
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    renderUnlock(makeCtx({ upload }))
    await userEvent.upload(screen.getByLabelText(/upload vault file/i), new File(['b'], 'v'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Failed to replace'))
    vi.unstubAllGlobals()

Run: yarn workspace @accounter/scraper-app test --reporter=verbose
```

---

## Prompt 10 — `VaultSetup`: upload-existing-vault alternative

> **Goal:** When there is no vault file at all, the user should be able to upload one instead of
> going through the 3-step creation wizard.

```
You are working in packages/scraper-app/src/ui/screens/vault-setup.tsx.

TASK
Add an "Upload an existing vault" section above the creation wizard.

CURRENT SHAPE: 3-step form.
FINAL SHAPE:
  [Setup Vault]
  <section> upload existing vault </section>
  <hr />
  <section> step 1 / 2 / 3 wizard (unchanged) </section>

CHANGES

1. Import useRef from 'react'.
2. Import { useVault } from '../contexts/vault-context.js'  (already imported — keep it).
3. Add state: const [uploadError, setUploadError] = useState<string | null>(null);
4. Add ref:  const fileInputRef = useRef<HTMLInputElement>(null);

5. Add handler (simpler than VaultUnlock — no vault exists, so 409 cannot happen):
     async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
       const file = e.target.files?.[0];
       if (!file) return;
       setUploadError(null);
       try {
         await vault.upload(file);
       } catch {
         setUploadError('Failed to upload vault. Please try again.');
       }
       if (fileInputRef.current) fileInputRef.current.value = '';
     }

6. At the top of the returned JSX, before the step === 1 block, insert:
     <div>
       <p>Upload an existing vault</p>
       <input
         ref={fileInputRef}
         id="vault-upload-setup"
         type="file"
         aria-label="Upload existing vault file"
         onChange={handleFileChange}
       />
       {uploadError && <p role="alert">{uploadError}</p>}
     </div>
     <hr />

TESTS  (add to src/ui/__tests__/vault-setup.test.tsx)

Update makeCtx to add upload: vi.fn().mockResolvedValue(undefined) to the base context object.

New describe block: 'VaultSetup — file upload'

- it 'renders the upload file input alongside the wizard'
    renderSetup()
    expect(screen.getByLabelText(/upload existing vault file/i)).toBeTruthy()
    expect(screen.getByText(/step 1/i)).toBeTruthy()  // wizard still visible

- it 'calls vault.upload when a file is selected'
    const upload = vi.fn().mockResolvedValue(undefined)
    renderSetup(makeCtx(vi.fn(), upload))   // adjust makeCtx signature to accept upload
    const file = new File(['blob'], 'test.vault')
    await userEvent.upload(screen.getByLabelText(/upload existing vault file/i), file)
    expect(upload).toHaveBeenCalledWith(file)

    Note: update makeCtx to accept a second argument upload = vi.fn():
      function makeCtx(create = vi.fn()..., upload = vi.fn()...) {
        return { ..., upload }
      }

- it 'shows uploadError when upload fails'
    const upload = vi.fn().mockRejectedValue(new Error('fail'))
    renderSetup(makeCtx(vi.fn(), upload))
    await userEvent.upload(screen.getByLabelText(/upload existing vault file/i), new File(['b'], 'v'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Failed to upload'))

Run: yarn workspace @accounter/scraper-app test --reporter=verbose
```

---

## Prompt 11 — `SettingsTab`: editable vault path + Download button

> **Goal:** The final UI piece. Replace the read-only vault path display with an editable input
> that moves the file on save, and add a Download button that triggers a browser save dialog.

```
You are working in packages/scraper-app/src/ui/screens/config/settings-tab.tsx.

TASK
1. Make the vault path input editable (saves vaultPath to vault settings on blur).
2. Add a Download vault button next to it.

CONTEXT
Currently the vault path section renders:
  <input readOnly value={vaultPath} aria-label="Vault file path" />
  <button>Copy path</button>

The vaultPath state is loaded from GET /api/vault/path (requires unlock). The env-path endpoint
returns the path to use as download filename hint when no saved path exists.

CHANGES

1. Import vaultDownload from '../../lib/api.js'.
   Import { basename } from — note: this is a browser context, node:path is not available.
   Instead, inline the basename extraction:
     function getBasename(p: string) {
       return p.split('/').pop()?.split('\\').pop() ?? '.vault';
     }

2. Add state: const [downloading, setDownloading] = useState(false);

3. The vaultPath state already exists and is loaded. Change the display input from readOnly to
   editable, following the same onBlur auto-save pattern as historyFilePath:

   Replace:
     <input readOnly value={vaultPath} ... aria-label="Vault file path" />
   With:
     <input
       id="vaultFilePath"
       type="text"
       value={vaultPath}
       onChange={e => setVaultPath(e.target.value)}
       onBlur={async e => {
         const val = e.target.value.trim();
         if (!val || val === vaultPath) return;
         await autoSave({ vaultPath: val });
         // autoSave updates settings; update local vaultPath display too
         setVaultPath(val);
       }}
       aria-label="Vault file path"
       style={{ padding: '4px 8px', width: '100%', maxWidth: 360 }}
       placeholder=".vault"
     />

4. Add a Download button after the Copy path button:
     <button
       type="button"
       disabled={downloading}
       onClick={async () => {
         setDownloading(true);
         try {
           await vaultDownload(getBasename(vaultPath || '.vault'));
         } catch {
           setError('Failed to download vault.');
         } finally {
           setDownloading(false);
         }
       }}
       style={{ padding: '4px 12px', whiteSpace: 'nowrap' }}
     >
       {downloading ? 'Downloading…' : 'Download'}
     </button>

5. The existing getVaultPath() call in useEffect should remain — it still populates the initial
   vaultPath display. No change needed there.

TESTS  (add to src/ui/__tests__/settings-tab.test.tsx)

Update mockFetch to also handle '/api/vault/path' returning { path: '/data/.vault' } and
'/api/vault/env-path' returning { path: '.vault' }. The current mock returns ok: false for
unknown URLs — extend it:

    if (url === '/api/vault/path') return { ok: true, json: async () => ({ path: '/data/.vault' }) }
    if (url === '/api/vault/env-path') return { ok: true, json: async () => ({ path: '.vault' }) }

New tests:

- it 'renders the vault path input as editable'
    render(<SettingsTab />)
    await waitFor(() => screen.getByLabelText(/vault file path/i))
    const input = screen.getByLabelText(/vault file path/i) as HTMLInputElement
    expect(input.readOnly).toBe(false)

- it 'saves vaultPath to settings on blur'
    const fetchMock = mockFetch()
    render(<SettingsTab />)
    await waitFor(() => screen.getByLabelText(/vault file path/i))
    const input = screen.getByLabelText(/vault file path/i)
    await userEvent.clear(input)
    await userEvent.type(input, '/new/path/.vault')
    await userEvent.tab()   // triggers blur
    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(([, opts]) => opts?.method === 'PUT')
      const bodies = putCalls.map(([, opts]) => JSON.parse(opts!.body as string))
      expect(bodies.some(b => b.vaultPath === '/new/path/.vault')).toBe(true)
    })

- it 'renders the Download button'
    render(<SettingsTab />)
    await waitFor(() => screen.getByRole('button', { name: /download/i }))
    expect(screen.getByRole('button', { name: /download/i })).toBeTruthy()

- it 'calls vaultDownload when Download is clicked'
    vi.mock('../../lib/api.js', async (importOriginal) => {
      const mod = await importOriginal<typeof import('../../lib/api.js')>()
      return { ...mod, vaultDownload: vi.fn().mockResolvedValue(undefined) }
    })
    render(<SettingsTab />)
    await waitFor(() => screen.getByRole('button', { name: /download/i }))
    await userEvent.click(screen.getByRole('button', { name: /download/i }))
    const { vaultDownload } = await import('../../lib/api.js')
    expect(vaultDownload).toHaveBeenCalled()

Run: yarn workspace @accounter/scraper-app test --reporter=verbose
All tests across the project must pass: yarn workspace @accounter/scraper-app test
```

---

## Final verification

After all 11 prompts are complete, run the full test suite to confirm nothing regressed:

```bash
yarn workspace @accounter/scraper-app test --reporter=verbose
```

And confirm TypeScript compiles cleanly:

```bash
yarn workspace @accounter/scraper-app build
```
