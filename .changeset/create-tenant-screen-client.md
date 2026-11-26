---
'@accounter/client': minor
---

Add a super-admin-only "Create Tenant" screen (`/admin/create-tenant`, linked from the user menu)
that calls `bootstrapNewClient` and shows the owner's invitation link with a copy button. The
invitation-acceptance screen now shows why acceptance failed (wrong account, unverified email,
expired or already-used invitation) and offers to sign out when another account is needed. The
welcome screen tells a signed-in user with a pending invitation to open their invitation link
instead of asking them to verify their email.
