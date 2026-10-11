---
'@accounter/server': patch
---

Track whether an invitation's Auth0 user was created by the invitation. `createBlockedUser` reuses
an existing Auth0 user for the email, but invitations always recorded `auth0_user_created = true`.
It now returns `{ userId, created }` (choosing deterministically when several users share an
email), and the real value is stored. The expired-invitation cleanup job, the `createInvitation`
rollback and invitation acceptance only unblock or delete Auth0 users the invitation created, that
were never used, and that no other invitation or membership references. When an existing member
accepts, the invitation now points at their user and the pending placeholder membership is removed.
