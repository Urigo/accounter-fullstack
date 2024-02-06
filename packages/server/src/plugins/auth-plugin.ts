import auth from 'basic-auth';
import { Plugin } from 'graphql-yoga';

export function useBasicAuth(): Plugin {
  return {
    onRequest({ request, fetchAPI, endResponse }) {
      const authorization = request.headers?.get('authorization') ?? undefined;
      const user = auth({ headers: { authorization } });

      if (!user) {
        const unauthorizedResponse = new fetchAPI.Response('Access denied', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Basicrealm="example"',
          },
        });
        endResponse(unauthorizedResponse);
      }
    },
  };
}
