# Super-Admin Runbook

## What Is a Super-Admin

A super-admin is an Auth0 user whose `auth0_user_id` appears in the `accounter_schema.super_admins`
table. Super-admins are platform operators — they are not tied to any tenant business and cannot be
created or managed through the app itself.

Currently, super-admin status gates the `bootstrapNewClient` GraphQL mutation, which provisions a
fully new tenant from scratch.

---

## Registering a Super-Admin

Super-admin rows must be inserted directly by a DBA (the app DB user has no INSERT privilege on
`super_admins` due to RLS). Use the provided seed script:

```bash
AUTH0_USER_ID='auth0|<id>' yarn workspace @accounter/server seed:super-admin
```

The script is idempotent (`ON CONFLICT DO NOTHING`). To find an Auth0 user ID, look it up in the
Auth0 dashboard under **User Management → Users**.

---

## Revoking a Super-Admin

Delete the row via a direct DBA connection:

```sql
DELETE FROM accounter_schema.super_admins WHERE auth0_user_id = 'auth0|<id>';
```

There is currently no revocation via the app or the seed script.

---

## Bootstrapping a New Client Tenant

Once a user has super-admin status, call the `bootstrapNewClient` mutation as that user:

```graphql
mutation {
  bootstrapNewClient(
    input: {
      businessName: "Acme Ltd"
      countryCode: "ISR"
      ownerEmail: "owner@acme.com"
      ownerRole: "business_owner"
    }
  ) {
    business {
      id
      name
    }
    invitationToken
    adminContext {
      id
    }
  }
}
```

What this creates in a single transaction:

1. Admin business entity (self-owned `financial_entities` + `businesses`)
2. Authority businesses: VAT, Tax, Social Security
3. Authority tax categories: Input Vat, Output Vat, Property Output Vat, Tax Expenses
4. General tax categories (12): exchange rates, fees, fines, balance cancellation, etc.
5. Cross-year tax categories (4): expenses/income to pay/advance
6. `user_context` row wiring all of the above together
7. A blocked Auth0 user for the new owner's email
8. An invitation row — the returned `invitationToken` is sent to the new owner out-of-band

The new owner accepts the invitation via the existing `acceptInvitation` mutation, which unblocks
their Auth0 account and activates their tenant.

---

## Database Security Model

The `super_admins` table has Row-Level Security enabled with a read-only policy:

- **SELECT**: allowed for the app DB user (needed to verify super-admin status at request time)
- **INSERT / UPDATE / DELETE**: blocked for the app DB user — only a direct DBA connection can
  modify the table

This prevents a compromised app process from self-promoting to super-admin status.

---

## Related Files

| File                                                                                | Purpose                                           |
| ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| `packages/server/scripts/seed-super-admin.ts`                                       | Seed script to register a super-admin             |
| `packages/server/src/modules/auth/providers/super-admin.provider.ts`                | Runtime authorization check (`requireSuperAdmin`) |
| `packages/server/src/modules/onboarding/providers/admin-onboarding.provider.ts`     | `bootstrapNewClient` orchestration                |
| `packages/migrations/src/actions/2026-05-12T14-00-00.create-super-admins-table.ts`  | Migration: `super_admins` table                   |
| `packages/migrations/src/actions/2026-05-12T17-30-00.rls-super-admins-read-only.ts` | Migration: RLS on `super_admins`                  |

---

## Future Work

See [plan.md](./plan.md) for the full super-admin cross-tenant access roadmap (Phase A–D), including
global client listing, tenant-switch flow, and audit logging.
