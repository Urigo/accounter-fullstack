import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Let a user always read the `financial_entities` row of every business they are
 * a member of, regardless of the request's narrowed read scope.
 *
 * The client sends `X-Business-Scope` once the user picks a business scope, and
 * `get_current_business_scope()` narrows every tenant read accordingly. That is
 * correct for data, but it also hid the *names* of the user's other memberships:
 * `Query.userContext.memberships` resolves each name through
 * `financial_entities`, so after the first scoped request the business switcher
 * in the client rendered out-of-scope memberships as bare UUIDs — and the very
 * list a user needs in order to *leave* a narrow scope became unreadable.
 *
 * A permissive `FOR SELECT` policy ORs with `tenant_isolation`, so this only
 * ever adds visibility, and only for rows whose id is one of the current user's
 * own memberships. `get_current_user_id()` is NULL for API-key requests, which
 * makes the subquery empty and leaves those requests exactly as they were.
 */
export default {
  name: '2026-08-26T10-00-00.rls-membership-financial-entities.sql',
  run: ({ sql }) => sql`
    CREATE POLICY membership_business_visibility ON accounter_schema.financial_entities
      FOR SELECT
      USING (
        id IN (
          SELECT bu.business_id
          FROM accounter_schema.business_users bu
          WHERE bu.user_id = accounter_schema.get_current_user_id()
        )
      );
  `,
} satisfies MigrationExecutor;
