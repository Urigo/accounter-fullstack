// TEMPORARY PLUGIN - Phase 2.9 to Phase 4.8
// Purpose: Set RLS context during transition period
// Removal: Phase 4.8 when providers migrate to TenantAwareDBClient
import type { PoolClient } from 'pg';
import { Plugin } from '@envelop/types';
import type { AccounterContext } from '../shared/types/index.js';

/**
 * RLS Context Plugin - TEMPORARY (Phase 2.9 → 4.8)
 *
 * Sets PostgreSQL session variables (app.current_business_id, app.current_user_id)
 * for Row-Level Security policies during the Phase 3-4 transition period.
 *
 * Architecture:
 * - Runs after authPlugin and adminContextPlugin (depends on currentUser in context)
 * - Creates per-request transaction with SET LOCAL variables
 * - Provides transaction client in context for providers to use
 * - Commits/rollbacks transaction at request end
 *
 * Migration Path:
 * - Phase 2.9: Plugin created and registered
 * - Phase 3: RLS enabled on tables (uses app.current_business_id from this plugin)
 * - Phase 4.1-4.7: Auth0 migration (plugin continues to work)
 * - Phase 4.8: Providers migrate to TenantAwareDBClient, this plugin removed
 *
 * @deprecated Will be removed in Phase 4.8 - do not use for new code
 */
export const rlsContextPlugin = (): Plugin<AccounterContext> => {
  return {
    async onExecute({ args }) {
      const context = args.contextValue;
      let client: PoolClient | null = null;

      // Only set RLS context if user is authenticated
      // currentUser.userId is the business ID (legacy auth uses business table)
      if (context.currentUser?.userId) {
        try {
          // Get dedicated connection from pool
          client = await context.pool.connect();

          // Start transaction and set LOCAL variables
          await client.query('BEGIN');
          // Use set_config to safely use parameters (SET command doesn't support $1)
          await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [
            context.currentUser.userId,
          ]);
          // Note: app.current_user_id not needed yet (no user-level RLS in Phase 3)
          // Can be added in future if needed

          // Add transaction client to context for providers
          // Providers should use: const client = context.rlsClient || context.pool
          context.rlsClient = client;
        } catch (error) {
          // Cleanup on error setup
          if (client) {
            await client.query('ROLLBACK').catch(() => {});
            client.release();
            client = null;
          }
          throw error;
        }
      }

      return {
        async onExecuteDone({ result }) {
          if (client) {
            try {
              // Check if there were any execution errors
              // result can be an ExecutionResult or AsyncIterable, check for errors property
              if (result && 'errors' in result && result.errors && result.errors.length > 0) {
                await client.query('ROLLBACK');
              } else {
                await client.query('COMMIT');
              }
            } catch (err) {
              console.error('Error committing/rolling back RLS transaction:', err);
              // Attempt rollback if commit failed?
              // If commit failed, transaction is aborted anyway usually.
            } finally {
              client.release();
            }
          }
        },
      };
    },
  };
};
