import type { RawAuth } from '../../plugins/auth-plugin.js';
import type { Environment } from './index.js';

declare global {
  namespace GraphQLModules {
    interface GlobalContext {
      env: Environment;
      rawAuth: RawAuth;
      dbClientsToDispose?: { dispose: () => Promise<void> }[];
    }
  }
}
