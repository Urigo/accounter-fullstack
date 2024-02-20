import auth from 'basic-auth';
import bcrypt from 'bcrypt';
import { EnumValueNode } from 'graphql';
import {
  ResolveUserFn,
  UnauthenticatedError,
  useGenericAuth,
  ValidateUserFn,
} from '@envelop/generic-auth';
import type { Role } from '@shared/gql-types';
import { AccounterContext } from '@shared/types';
import { env } from '../environment.js';

type UserType = {
  username: string;
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
      role,
    };
  } catch (e) {
    console.error('Failed to validate token');

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

const validateUser: ValidateUserFn<UserType> = ({ user, fieldAuthDirectiveNode }) => {
  // Now you can use the fieldAuthDirectiveNode parameter to implement custom logic for user validation, with access
  // to the resolver auth directive arguments.
  if (!user) {
    return new UnauthenticatedError(`Unauthenticated!`);
  }

  const valueNode = fieldAuthDirectiveNode?.arguments?.find(arg => arg.name.value === 'role')
    ?.value as EnumValueNode | undefined;
  if (!valueNode) {
    return;
  }

  const role = valueNode.value;
  const acceptableRoles = getAcceptableRoles(role);

  if (!user.role || !acceptableRoles.includes(user.role)) {
    return new UnauthenticatedError(`No permissions!`);
  }
  return;
};

export const authPlugin = () =>
  useGenericAuth({
    resolveUserFn,
    validateUser,
    mode: 'protect-granular',
  });
