import { useExtendContext, YogaInitialContext } from 'graphql-yoga';
import type { Plugin } from '@envelop/types';

export interface RawAuth {
  authType: 'jwt' | 'apiKey' | 'devBypass' | null;
  token: string | null;
}

/**
 * AuthPlugin - Extracts authentication credentials from request headers.
 *
 * This plugin is part of the Auth0 authentication system.
 * It ONLY handles credential extraction. Verification and context creation
 * are delegated to the AuthContextProvider.
 *
 * Responsibilities:
 * 1. Extract `Authorization: Bearer <token>` (JWT)
 * 2. Extract `X-API-Key: <key>` (API Key)
 * 3. Add `rawAuth` object to Yoga context
 */
export const authPlugin = (): Plugin<{ rawAuth: RawAuth }> => {
  return useExtendContext(
    async (yogaContext: YogaInitialContext): Promise<{ rawAuth: RawAuth }> => {
      const request = yogaContext.request;
      const authHeader = request.headers.get('authorization');
      const apiKeyHeader = request.headers.get('x-api-key');

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
