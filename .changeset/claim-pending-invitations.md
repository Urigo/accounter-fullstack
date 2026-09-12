---
'@accounter/server': minor
'@accounter/client': minor
---

Let a user claim an invitation waiting for their verified email, without the emailed link.

Signing up before opening the invitation link was a dead end. Invitation tokens are stored hashed,
so a listed invitation cannot be turned back into its token, and the verified-email fallback in
`mapAuth0UserToLocal` only matched invitations that had *already* been accepted — so a pending one
never matched. The user landed on `/welcome` with no way forward.

Server: `viewer.pendingInvitations` lists unaccepted, unexpired invitations addressed to the
caller's verified email, and a new `claimInvitation(invitationId)` mutation accepts one. The
security model is stricter than the token path deliberately: `acceptInvitation` treats possession of
the token as proof, so its email check is defence in depth, whereas here the verified email is the
*only* proof — it is mandatory, checked before any database access, and an unverified address never
matches anything. Missing, expired, already-accepted and wrong-recipient invitations all report the
same error, so the mutation cannot be used to probe for invitation ids. Both entry points now share
one `finalizeAcceptance()` step — claimant check, user linking, Auth0 cleanup, audit log — so the
two paths cannot drift apart.

Client: `/welcome` lists the waiting invitations with one-click accept in place of the dead-end
copy, and returns to the app once one is claimed.
