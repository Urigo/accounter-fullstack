---
'@accounter/server': minor
---

`acceptInvitation` now reports `INVITATION_EMAIL_MISMATCH` (naming the invited and the signed-in
address) and `EMAIL_NOT_VERIFIED` instead of a generic "Invalid invitation token", and the expired
and already-used errors say which. `viewer` gains `isSuperAdmin` and `hasPendingInvitation`, and for
an unlinked caller whose access token carries no email it reads the email from the Auth0 profile.
