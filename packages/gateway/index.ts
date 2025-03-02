import { createServer } from 'node:http';
import { createGatewayRuntime } from '@graphql-hive/gateway-runtime';
import http from '@graphql-mesh/transport-http';

const gateway = createGatewayRuntime({
  supergraph: '../../supergraph.graphql',
  transports: { http },
});
const server = createServer(gateway);
server.listen(4000, () => {
  console.log(`Server is running on http://localhost:4000`);
});

export default { fetch: gateway };
