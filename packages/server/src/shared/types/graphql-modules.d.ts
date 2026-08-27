import type { RawAuth } from '../../plugins/auth-plugin.js';
import type { DisposableDbClient, Environment } from './index.js';

declare global {
  namespace GraphQLModules {
    interface GlobalContext {
      env: Environment;
      rawAuth: RawAuth;
      dbClientsToDispose?: DisposableDbClient[];
      /** See `AccounterContext.executionInFlight`. */
      executionInFlight?: boolean;
    }
  }
}
