import { AUTH_ROLE, AUTH_USER_ID, AUTH_USERNAME } from '../server/src/shared/constants';
import { AccounterGatewayPlugin } from './plugins/types';

export function useForwordAuthInfoToSubgraph(): AccounterGatewayPlugin {
  return {
    onFetch(params) {
      const { currentUser } = params.context;
      if (!currentUser) {
        return;
      }
      params.setOptions({
        ...params.options,
        headers: {
          ...params.options.headers,
          [AUTH_ROLE]: currentUser.role,
          [AUTH_USERNAME]: currentUser.username,
          [AUTH_USER_ID]: currentUser.userId,
        },
      });
    },
  };
}
