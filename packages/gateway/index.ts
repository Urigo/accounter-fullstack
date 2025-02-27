import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGatewayRuntime } from '@graphql-hive/gateway-runtime';
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { UserType } from '../server/src/shared/types/index.js';
import { useForwordAuthInfoToSubgraph } from './helpers.js';
import { getAcceptableRoles, resolveUser, validateUser } from './plugins/auth.js';
import { ValidateUserType } from './plugins/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SUPERGRAPH_PATH = join(__dirname, '../../supergraph.graphql');
const supergraphSdl = readFileSync(SUPERGRAPH_PATH, 'utf8');

async function main() {
  const gateway = createGatewayRuntime({
    graphqlEndpoint: '/graphql',
    genericAuth: {
      mode: 'protect-granular',
      resolveUserFn: context => resolveUser(context),
      validateUser: (validateUserFields: ValidateUserType) => {
        const { parentType, fieldDirectives, user } = validateUserFields;

        return validateUser({ user, fieldDirectives, parentType });
      },
      extractScopes: (user: UserType) => getAcceptableRoles(user.role),
    },
    supergraph: () => supergraphSdl,
    plugins: _ctx => {
      return [useForwordAuthInfoToSubgraph(), useDeferStream()];
    },
  });

  const server = createServer(gateway);
  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    console.log(`🚀 Gateway running at http://localhost:${PORT}/graphql`);
  });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
