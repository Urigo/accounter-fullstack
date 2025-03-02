import { createServer } from 'node:http';
import { createGatewayRuntime } from '@graphql-hive/gateway-runtime';
import http from '@graphql-mesh/transport-http';
import { env } from '../server/src/environment';

const gateway = createGatewayRuntime({
  supergraph: {
    type: 'hive',
    endpoint: 'https://cdn.graphql-hive.com/artifacts/v1/1766c3d3-f0ba-46ff-8252-1ec116d07123',
    key: env.hive.hiveMainRegistryToken,
  },
  transports: { http },
});
const server = createServer(gateway);
server.listen(4000, () => {
  console.log(`Server is running on http://localhost:4000`);
});

export default { fetch: gateway };
