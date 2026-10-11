---
'@accounter/server': patch
---

`acceptInvitation` now requires a signed-in user, and the accepting account's verified email must
match the invitation email. API-key and gateway control-plane callers are rejected with
`UNAUTHENTICATED`. The GraphQL signature is unchanged; the client already signs users in before
accepting.
