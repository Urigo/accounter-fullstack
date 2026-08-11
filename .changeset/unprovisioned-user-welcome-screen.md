---
'@accounter/server': minor
'@accounter/client': minor
---

Route authenticated users who are not linked to any business to a dedicated `/welcome` screen,
instead of an empty dashboard behind failing queries.

An Auth0 identity with no row in `business_users` resolves to a `null` auth context, so every
`@requiresAuth` field threw `UNAUTHENTICATED`. The client read that as a token failure and ran
`refreshAuth` — which succeeds, because the token was never bad — optionally prompting an
interactive re-login, while every failed operation raised its own error toast.

Server: `@requiresAuth` now distinguishes the two cases, throwing `ONBOARDING_REQUIRED` for a
verified JWT identity that maps to no membership and keeping `UNAUTHENTICATED` for missing or
invalid credentials. A new `viewer` query — deliberately unauthenticated-safe, like
`acceptInvitation` — reports the caller's own provisioning state (`ACTIVE`, `EMAIL_UNVERIFIED` or
`NO_WORKSPACE`) from its own token claims, and nothing more. Membership takes precedence over email
verification, so a linked caller stays `ACTIVE` even with an unverified address. `getJwtIdentity()`
is now memoized per operation, since the directive calls it on every guarded field that fails to
resolve a context.

Client: a new `OnboardingGuard` inside `ProtectedRoute` sends a non-`ACTIVE` viewer to `/welcome`,
which explains the invitation-only model (or asks for email verification) and offers *Check again*
and *Sign out*. It fails open on a query error, rendering the app rather than trapping the user, and
says the check failed rather than asserting "No workspace yet" when the viewer state is unknown.
`ONBOARDING_REQUIRED` no longer raises an error toast per failed operation.
