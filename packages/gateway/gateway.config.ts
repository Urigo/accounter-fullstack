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
});
