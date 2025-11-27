import auth, { type BasicAuthResult } from 'basic-auth';
import bcrypt from 'bcrypt';
import { GraphQLError } from 'graphql';
import pg from 'pg';
import { ResolveUserFn, useGenericAuth, ValidateUserFn } from '@envelop/generic-auth';
import { sql } from '@pgtyped/runtime';
import type { Role } from '@shared/gql-types';
import { getCacheInstance } from '@shared/helpers';
import { AccounterContext } from '@shared/types';
import { env } from '../environment.js';
import type { IGetUserByNameQuery } from './__generated__/auth-plugin.types.js';

const getUserByName = sql<IGetUserByNameQuery>`
  SELECT *
  FROM accounter_schema.users
  WHERE name = $userName`;

const cache = getCacheInstance({
  stdTTL: 60,
});

export type UserType = {
  username: string;
  userId: string;
  role?: Role;
};

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

function validateRequestUser(user: BasicAuthResult) {
  const { name, pass } = user;
  const storedPass = authorizedUsers[name] ?? '';
  return bcrypt.compareSync(pass, storedPass);
}

async function getUserInfo(
  user: BasicAuthResult,
): Promise<{ role: Role; adminBusinessId: string } | undefined> {
  const validate = validateRequestUser(user);
  if (!validate) {
    return undefined;
  }

  const userName = user.name;

  const client = new pg.Client({
    user: env.postgres.user,
    password: env.postgres.password,
    host: env.postgres.host,
    port: Number(env.postgres.port),
    database: env.postgres.db,
    ssl: env.postgres.ssl ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    const [user] = await getUserByName.run({ userName }, client);
    if (!user) {
      throw new Error('User not found');
    }
    cache.set(userName, user);

    if (!user.role || !user.id) {
      return undefined;
    }

    return {
      role: user.role as Role,
      adminBusinessId: user.id,
    };
  } catch (error) {
    console.error('Error fetching user:', error);
    throw new Error('Error fetching user info');
  } finally {
    await client.end();
  }
}

const resolveUserFn: ResolveUserFn<UserType, AccounterContext> = async context => {
  try {
    const user = getUserFromRequest(context.request);
    if (!user) {
      throw new Error('User not valid');
    }

    const userInfo = await getUserInfo(user);
    if (!userInfo) {
      throw new Error('User role not valid');
    }

    return {
      username: user.name,
      userId: userInfo.adminBusinessId,
      role: userInfo.role,
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
