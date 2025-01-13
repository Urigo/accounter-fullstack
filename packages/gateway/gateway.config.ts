import { env } from 'packages/server/src/environment';
import { defineConfig } from '@graphql-hive/gateway';

const hiveCdnEndpoint = env.hive.hiveCdnEndpoint;
const hiveCdnKey = env.hive.hiveCdnKey;

if (!hiveCdnEndpoint || !hiveCdnKey) {
  throw new Error('Hive CDN endpoint or key is missing');
}

export const gatewayConfig = defineConfig({
  supergraph: {
    type: 'hive',
    endpoint: hiveCdnEndpoint,
    key: hiveCdnKey,
  },
  // Configure header propagation to forward auth headers to subgraphs
  propagateHeaders: {
    fromClientToSubgraphs({ request }) {
      const authHeader = request.headers.get('authorization');
      // Only return the header if it exists
      if (authHeader) {
        return {
          authorization: authHeader,
        };
      }
      // Return void if no auth header
      return;
    },
  },
  // Configure generic auth for the Gateway
  genericAuth: {
    mode: 'protect-granular',
    resolveUserFn: context => {
      const authorization = context.request.headers.get('authorization');
      if (!authorization) {
        return null;
      }

      // Forward the auth info to subgraphs through context
      return {
        authorization,
      };
    },
    rejectUnauthenticated: true,
  },
});
