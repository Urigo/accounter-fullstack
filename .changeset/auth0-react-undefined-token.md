---
'@accounter/client': patch
---

Treat an absent Auth0 access token as "unauthenticated" instead of letting it break the build.

`@auth0/auth0-react` 2.27.0 stopped declaring its own overloads for `getAccessTokenSilently` and now
aliases it to `Auth0Client['getTokenSilently']`, which `@auth0/auth0-spa-js` 2.27.0 widened from
`Promise<string>` to `Promise<string | undefined>`. The token bridge in `src/index.tsx` fed that
result straight into the urql provider's `{ status: 'token'; token: string }` resolution, so the
client build failed to typecheck on the bump.

The widening tracks a real new runtime case rather than a stricter type: `_getTokenSilently` returns
`undefined` when the ID token's `session_expiry` claim has passed — the SDK clears the local session
and gives back nothing instead of rejecting. That is the same dead end as the `login_required` /
`invalid_grant` / `missing_refresh_token` errors the provider already classifies, so it now resolves
to `{ status: 'unauthenticated' }`. `refreshAuth` reacts by dropping the bearer token and offering
in-place re-authentication, where reporting an error would have shown a misleading network failure
and left the user stuck on an unrenewable session.

The callback moved out of `src/index.tsx` — which renders on import and so was untestable — into
`createAuth0AccessTokenProvider` in `src/lib/auth0-token-provider.ts`, with unit tests covering each
outcome. Behaviour is otherwise unchanged; the provider types in `src/providers/urql.tsx` are now
exported so the factory shares them rather than restating the shape.
