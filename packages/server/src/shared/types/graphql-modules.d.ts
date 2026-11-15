import type { RawAuth } from '../../plugins/auth-plugin.js';
import type { DbRequestState, Environment, RequestLogState } from './index.js';

declare global {
  namespace GraphQLModules {
    interface GlobalContext {
      env: Environment;
      rawAuth: RawAuth;
      /** See `AccounterContext.dbRequest`. */
      dbRequest?: DbRequestState;
      /** See `AccounterContext.requestLog`. */
      requestLog?: RequestLogState;
    }
  }
}
