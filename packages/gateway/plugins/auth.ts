import auth from 'basic-auth';
import bcrypt from 'bcrypt';
import { GraphQLError } from 'graphql';
import { env } from '../../../packages/server/src/environment.js';
import { UserType } from '../../../packages/server/src/shared/types/index.js';

export type Role = 'ACCOUNTANT' | 'ADMIN';

function getAuthorizedUsers(): Record<string, string> {
  try {
    console.log('getAuthorizedUsers: env.authorization.users', env.authorization.users);
    return JSON.parse(env.authorization.users ?? '{}');
  } catch (e) {
    console.error('Failed to read authorized users from env file.', e);
    return {};
  }
}

const authorizedUsers = getAuthorizedUsers();
console.log('authorizedUsers', authorizedUsers);

function getUserFromRequest(request: Request) {
  const authorization = request.headers?.get('authorization') ?? undefined;
  console.log('authorization', authorization);
  return auth({ headers: { authorization } });
}

function validateRequestUser(user: ReturnType<typeof auth>) {
  if (!user) {
    return false;
  }
  const { name, pass } = user;
  console.log('name', name);
  console.log('pass', pass);
  const storedPass = authorizedUsers[name] ?? '';
  return bcrypt.compareSync(pass, storedPass);
}

function getUserRole(user: ReturnType<typeof auth>): Role | undefined {
  const validate = validateRequestUser(user);
  console.log('validate', validate);
  if (!validate) {
    return undefined;
  }

  switch (user!.name) {
    case 'accountant':
      return 'ACCOUNTANT';
    case 'admin':
      return 'ADMIN';
    default:
      return undefined;
  }
}
/* eslint-disable @typescript-eslint/no-explicit-any */
export function resolveUser(context: any): UserType | null {
  try {
    const user = getUserFromRequest(context.request);
    console.log('user', user);
    const role = getUserRole(user);
    console.log('role', role);

    if (!user || !role) {
      throw new Error('User not valid');
    }

    return {
      username: user.name,
      userId: env.authorization.adminBusinessId, // TODO: replace with actual authentication
      role,
    };
  } catch (e) {
    console.error('Failed to validate token', e);

    return null;
  }
}

export function getAcceptableRoles(role?: Role) {
  console.log('role', role);
  switch (role) {
    case 'ACCOUNTANT':
      return ['ACCOUNTANT'];
    case 'ADMIN':
      return ['ACCOUNTANT', 'ADMIN'];
    default:
      return [];
  }
}
/* eslint-disable @typescript-eslint/no-explicit-any */
export function validateUser({ user, fieldDirectives, parentType }: any) {
  if (!user) {
    return new GraphQLError(`Unauthenticated!`);
  }
  console.log('parentType', parentType);
  console.log('fieldDirectives', fieldDirectives);
  console.log('user', user);

  // case sub-field with no auth directive
  if (!['Query', 'Mutation'].includes(parentType.name) && !fieldDirectives?.auth) {
    return;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const role = fieldDirectives?.auth?.find((arg: any) => 'role' in arg)?.role;
  const acceptableRoles = getAcceptableRoles(role);

  if (user.role && acceptableRoles.includes(user.role)) {
    return;
  }
  return new GraphQLError(`No permissions!`);
}
