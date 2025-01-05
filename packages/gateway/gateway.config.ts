import { env } from 'packages/server/src/environment';
import { defineConfig } from '@graphql-hive/gateway';

export const gatewayConfig = defineConfig({
  supergraph: {
    type: 'hive',
    endpoint: env.hive.hiveCdnEndpoint ?? '',
    key: env.hive.hiveCdnKey ?? '',
  },
});
