---
---

Handle the two `auth0` v7 breaking changes that actually reach this repo, alongside the v7 bump
itself.

- **`uuid` is no longer a transitive dependency.** v6 depended on `uuid@^11.1.1`, and
  `packages/server/src/shared/helpers/deterministic-uuid.ts` imported `uuid` without the server ever
  declaring it — the import resolved only because the `node-modules` linker hoisted auth0's copy to
  the root. v7 drops the dependency, so that copy went away and the import started resolving to
  `uuid@14.0.2` hoisted from `@accounter/modern-poalim-scraper` instead: still working, but by
  accident, a silent 11 → 14 major jump, and one that breaks outright the day that scraper drops or
  moves its own `uuid`. The server now declares `uuid@14.0.2` explicitly. `makeUUID` output is
  unaffected — v5 UUIDs are SHA-1 based and spec-deterministic, and v11 and v14 were verified to
  produce identical output for the same namespace and name, so nothing already persisted shifts.
- **`AUTH0_DOMAIN` must be a bare hostname.** The v7 `ManagementClient` constructor validates
  `domain` and throws when it carries a scheme, path, query string or fragment, where v6 accepted the
  value and produced malformed request URLs that surfaced later as `401`s. `Auth0ManagementProvider`
  builds its client from its own constructor and is a global `Scope.Singleton`, so that throw would
  come out of the DI container rather than from anything resembling config validation. The
  environment schema now rejects such values up front with a message naming the fix, which also
  matches what the rest of the codebase already assumed — `auth-context.provider.ts` interpolates the
  same value into `https://${domain}/.well-known/jwks.json`.

The rest of the v7 surface needed no changes, and this was verified rather than assumed:

- The removal of `AuthenticationClient` and `UserInfoClient` from the main entrypoint doesn't apply —
  `ManagementClient` is the only thing imported from `auth0` anywhere, and the client-side
  `@auth0/auth0-react` is an unrelated SDK.
- All six Management API call sites (`users.listUsersByEmail`, `users.get`, `users.create`,
  `users.update`, `users.delete`, `tickets.changePassword`) typecheck clean against v7's real
  declarations, including the response shapes the provider destructures. v6 was already the
  Fern-generated client, so the dropped `JSONApiResponse` wrapper changes nothing here: awaiting an
  `HttpResponsePromise` still yields the data directly.
- Token-acquisition failures now throw `ManagementError` instead of a plain `Error`. It extends
  `Error` and folds the status code and response body into `message`, so the provider's existing
  `(error as Error).message` handling keeps working and gets strictly better diagnostics.
- mTLS' new mandatory explicit `fetch` doesn't apply — `useMTLS` is never set.

Note that `packages/server/src/modules/auth/providers/__tests__/auth0-management.test.ts` mocks the
`auth0` module wholesale, so it asserts against the mock's signatures and cannot catch a real SDK
signature change in either direction. `tsc` over the provider is what covers that, which is why the
call sites were checked against the installed v7 types directly.
