import { EnumValueNode } from 'graphql';
import {
  ResolveUserFn,
  UnauthenticatedError,
  useGenericAuth,
  ValidateUserFn,
} from '@envelop/generic-auth';
import type { Role } from '@shared/gql-types';
import { AccounterContext } from '@shared/types';

type UserType = {
  username: string;
  role?: Role;
};

function getUserFromRequest(context: { req: Request & { user?: string | undefined } }) {
  return context?.req?.user;
}

function getRole(username: string | undefined): Role | undefined {
  switch (username) {
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
    const username = getUserFromRequest(context as unknown as { req: Request });
    const role = getRole(username);

    if (!username || !role) {
      throw new Error('User not valid');
    }

    return {
      username,
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
