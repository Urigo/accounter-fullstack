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
      /** See `AccounterContext.dbClientsDisposed`. */
      dbClientsDisposed?: boolean;
      /** See `AccounterContext.requestId`. */
      requestId?: string;
      /** See `AccounterContext.operationName`. */
      operationName?: string;
    }
  }
}
