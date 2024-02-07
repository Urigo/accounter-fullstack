import auth from 'basic-auth';
import bcrypt from 'bcrypt';
import { Plugin } from 'graphql-yoga';
import { AccounterContext, Role } from '@shared/types';

// const users = new WeakMap();

const authorizedUsers: Record<string, string> = {
  accountant: '$2b$10$7fUXZSIW3dQ2sSfI9vMatOADIEsJY9b5oX8Bs1jTfK/NZ24OgOfua',
  admin: '$2b$10$A7Cg5qTaMDfui4xrHbZS/.26J8ic848wG20MRL1ZlLcxYZ/FzymcG',
};

function getUserFromRequest(request: Request) {
  const authorization = request.headers?.get('authorization') ?? undefined;
  return auth({ headers: { authorization } });
}

function validateUser(user: ReturnType<typeof auth>) {
  if (!user) {
    return false;
  }
  const { name, pass } = user;
  const storedPass = authorizedUsers[name] ?? '';
  return bcrypt.compareSync(pass, storedPass);
}

function getRole(user: ReturnType<typeof auth>): Role | undefined {
  const validate = validateUser(user);
  if (!validate) {
    return undefined;
  }

  switch (user!.name) {
    case 'accountant':
      return 'accountant';
    case 'admin':
      return 'admin';
    default:
      return undefined;
  }
}

export function useBasicAuth(): Plugin<AccounterContext> {
  return {
    onRequest({ request, fetchAPI, endResponse }) {
      const user = getUserFromRequest(request);

      /* log hashed password to console */
      // if (user) {
      //   bcrypt.hash(user.pass, 10, (_err, hash) => {
      //     console.log(`${user.name}: "${hash}"`)
      //   });
      // }

      const validated = validateUser(user);

      if (!user || !validated) {
        const unauthorizedResponse = new fetchAPI.Response('Access denied', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Basicrealm="example"',
          },
        });
        endResponse(unauthorizedResponse);
      }
    },
    onContextBuilding({ context, extendContext }) {
      const user = getUserFromRequest(context.request);
      const role = getRole(user);

      extendContext({
        session: {
          role,
        },
      });
    },
  };
}
