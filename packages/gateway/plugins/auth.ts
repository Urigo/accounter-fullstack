import auth from 'basic-auth';
import bcrypt from 'bcrypt';
import { GraphQLError } from 'graphql';
import { env } from '../../../packages/server/src/environment.js';
import { UserType } from '../../../packages/server/src/shared/types/index.js';
import { Role, ValidateUserType } from './types.js';

function getAuthorizedUsers(): Record<string, string> {
  try {
    return JSON.parse(env.authorization.users ?? '{}');
  } catch (e) {
    console.error('Failed to read authorized users from env file.', e);
    return {};
  }
}

const authorizedUsers = getAuthorizedUsers();

function getUserFromRequest(request: Request) {
  const authorization = request.headers?.get('authorization') ?? undefined;
  return auth({ headers: { authorization } });
}

function validateRequestUser(user: ReturnType<typeof auth>) {
  if (!user) {
    return false;
  }
  const { name, pass } = user;
  const storedPass = authorizedUsers[name] ?? '';
  return bcrypt.compareSync(pass, storedPass);
}

function getUserRole(user: ReturnType<typeof auth>): Role | undefined {
  const validate = validateRequestUser(user);
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
    const role = getUserRole(user);

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

export function getAcceptableRoles(role?: string) {
  switch (role) {
    case 'ADMIN':
      return ['ADMIN'];
    case 'ACCOUNTANT':
      return ['ACCOUNTANT', 'ADMIN'];
    default:
      return [];
  }
}

export function validateUser({ user, fieldDirectives, parentType }: ValidateUserType) {
  if (!user) {
    return new GraphQLError(`Unauthenticated!`);
  }

  // case sub-field with no auth directive
  if (!['Query', 'Mutation'].includes(parentType.name) && !fieldDirectives?.auth) {
    return;
  }

  const role = fieldDirectives?.auth?.find(arg => 'role' in arg)?.role;
  const acceptableRoles = getAcceptableRoles(role);

  if (user.role && acceptableRoles.includes(user.role as string)) {
    return;
  }
  return new GraphQLError(`No permissions!`);
}
