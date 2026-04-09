import { useExtendContext, YogaInitialContext } from 'graphql-yoga';
import type { Plugin } from '@envelop/types';
import type { DBProvider } from '../modules/app-providers/db.provider.js';
import { handleDevBypassAuth } from '../modules/auth/providers/auth-context.provider.js';

export interface RawAuth {
  authType: 'jwt' | 'apiKey' | 'devBypass' | null;
  token: string | null;
}

type QueryablePool = {
  query: (text: string, values?: unknown[]) => Promise<unknown>;
};

/**
 * AuthPlugin - Extracts authentication credentials from request headers.
 *
 * This plugin is part of the Auth0 authentication system.
 * It ONLY handles credential extraction. Verification and context creation
 * are delegated to the AuthContextProvider.
 *
 * Responsibilities:
 * 1. Extract `X-Dev-Auth: <user-id>` (Dev Bypass, gated by ALLOW_DEV_AUTH=1)
 * 1. Extract `Authorization: Bearer <token>` (JWT)
 * 2. Extract `X-API-Key: <key>` (API Key)
 * 3. Add `rawAuth` object to Yoga context
 */
export const authPlugin = (): Plugin<{ rawAuth: RawAuth }> => {
  const allowDevAuth = process.env.ALLOW_DEV_AUTH === '1';
  if (allowDevAuth) {
    // eslint-disable-next-line no-console
    console.warn('⚠️ DEV AUTH BYPASS ENABLED');
  }

  return useExtendContext(
    async (yogaContext: YogaInitialContext): Promise<{ rawAuth: RawAuth }> => {
      const request = yogaContext.request;
      const devAuthHeader = request.headers.get('x-dev-auth');
      const authHeader = request.headers.get('authorization');
      const apiKeyHeader = request.headers.get('x-api-key');

      // Dev bypass takes precedence when explicitly enabled and user is resolvable.
      if (allowDevAuth && devAuthHeader) {
        const userId = devAuthHeader.trim();
        if (userId.length > 0) {
          const pool = (yogaContext as YogaInitialContext & { pool?: QueryablePool }).pool;
          if (pool) {
            const db = {
              query: async (queryStatement: string, values?: unknown[]) => {
                const result = await pool.query(queryStatement, values);
                return {
                  ...(result as object),
                  rowCount:
                    typeof (result as { rowCount?: number | null }).rowCount === 'number'
                      ? (result as { rowCount: number }).rowCount
                      : 0,
                };
              },
            } as Pick<DBProvider, 'query'>;

            const context = await handleDevBypassAuth(db, userId);
            if (context) {
              return {
                rawAuth: {
                  authType: 'devBypass',
                  token: userId,
                },
              };
            }
          }
        }
      }

      // JWT takes precedence (e.g., user operations)
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (token.length > 0) {
          return {
            rawAuth: {
              authType: 'jwt',
              token,
            },
          };
        }
      }

      // Fallback to API key (e.g., automated tools)
      if (apiKeyHeader) {
        const token = apiKeyHeader.trim();
        if (token.length > 0) {
          return {
            rawAuth: {
              authType: 'apiKey',
              token,
            },
          };
        }
      }

      // Unauthenticated or malformed headers
      return {
        rawAuth: {
          authType: null,
          token: null,
        },
      };
    },
  );
};
