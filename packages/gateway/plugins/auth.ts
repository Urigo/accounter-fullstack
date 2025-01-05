import auth from 'basic-auth';
import bcrypt from 'bcrypt';
import { GraphQLError } from 'graphql';
import { env } from '../../../packages/server/src/environment.js';
import { UserType } from '../../../packages/server/src/shared/types/index.js';
import { AuthContext, AuthDirective, Role, ValidateUserArgs, ValidateUserType } from './types.js';

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
export function resolveUser(context: AuthContext): UserType | null {
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

export function getAcceptableRoles(role?: Role) {
  switch (role) {
    case 'ACCOUNTANT':
      return ['ACCOUNTANT'];
    case 'ADMIN':
      return ['ACCOUNTANT', 'ADMIN'];
    default:
      return [];
  }
}
export function validateUser({ user, fieldDirectives, parentType }: ValidateUserArgs) {
  if (!user || !Object.keys(user).length) {
    return new GraphQLError(`Unauthenticated!`);
  }

  // case sub-field with no auth directive
  if (!['Query', 'Mutation'].includes(parentType.name) && !fieldDirectives?.auth) {
    return;
  }

  const role = fieldDirectives?.auth?.find((arg: AuthDirective) => 'role' in arg)?.role;
  const acceptableRoles = getAcceptableRoles(role);

  if ('role' in user && acceptableRoles.includes(user.role as string)) {
    return;
  }
  if ('role' in user && user.role === 'ADMIN') {
    return;
  }
  return new GraphQLError(`No permissions!`);
}
