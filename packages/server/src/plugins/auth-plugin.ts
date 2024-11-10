import auth from 'basic-auth';
import bcrypt from 'bcrypt';
import { GraphQLError } from 'graphql';
import { ResolveUserFn, useGenericAuth, ValidateUserFn } from '@envelop/generic-auth';
import { DEFAULT_FINANCIAL_ENTITY_ID } from '@shared/constants';
import type { Role } from '@shared/gql-types';
import { AccounterContext } from '@shared/types';
import { env } from '../environment.js';

export type UserType = {
  username: string;
  userId: string;
  role?: Role;
};

function getAuthorizedUsers(): Record<string, string> {
  try {
    return JSON.parse(env.authorization.users ?? '{}');
  } catch (e) {
    console.error('Failed to read authorized users from env file.');
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

const resolveUserFn: ResolveUserFn<UserType, AccounterContext> = async context => {
  try {
    const user = getUserFromRequest(context.request);
    const role = getUserRole(user);

    if (!user || !role) {
      throw new Error('User not valid');
    }

    return {
      username: user.name,
      userId: DEFAULT_FINANCIAL_ENTITY_ID, // TODO: replace with actual authentication
      role,
    };
  } catch (e) {
    console.error('Failed to validate token', e);

    return null;
  }
};

const getAcceptableRoles = (role?: string) => {
  switch (role) {
    case 'ADMIN':
      return ['ADMIN'];
    case 'ACCOUNTANT':
      return ['ACCOUNTANT', 'ADMIN'];
    default:
      return [];
  }
};

const validateUser: ValidateUserFn<UserType> = ({ user, fieldDirectives, parentType }) => {
  if (!user) {
    return new GraphQLError(`Unauthenticated!`);
  }

  // case sub-field with no auth directive
  if (!['Query', 'Mutation'].includes(parentType.name) && !fieldDirectives?.auth) {
    return;
  }

  const role = fieldDirectives?.auth?.find(arg => 'role' in arg)?.role;
  const acceptableRoles = getAcceptableRoles(role);

  if (user.role && acceptableRoles.includes(user.role)) {
    return;
  }
  return new GraphQLError(`No permissions!`);
};

export const authPlugin = () =>
  useGenericAuth({
    resolveUserFn,
    validateUser,
    mode: 'protect-granular',
    extractScopes: user => getAcceptableRoles(user?.role),
  });
