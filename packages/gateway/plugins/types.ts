import type { GraphQLInterfaceType, GraphQLObjectType } from 'graphql';
import type { GatewayContext, GatewayPlugin } from '@graphql-hive/gateway';

export type Role = 'ACCOUNTANT' | 'ADMIN';

export interface UserType {
  username: string;
  userId: string;
  role: Role;
}

// Define a more specific type for directive arguments
export interface AuthDirective {
  role?: Role;
  [key: string]: unknown;
}

export interface AuthContext {
  request: Request;
}

export interface ValidateUserArgs {
  user: UserType | null;
  fieldDirectives?: { auth?: Array<{ role?: Role }> };
  parentType: { name: string };
}

export interface ValidateUserType {
  parentType: GraphQLObjectType | GraphQLInterfaceType;
  fieldDirectives?: {
    auth?: AuthDirective[];
    [key: string]: unknown[] | undefined;
  };
  user: UserType | null;
}

export interface AccounterGatewayContext extends GatewayContext {
  currentUser: UserType;
  req: Request;
  res: Response;
}

export interface PluginFetchParams {
  context: AccounterGatewayContext;
  options: {
    headers: Record<string, string>;
    [key: string]: unknown;
  };
  setOptions: (options: { headers: Record<string, string>; [key: string]: unknown }) => void;
}

export type AccounterGatewayPlugin = GatewayPlugin<AccounterGatewayContext>;

// Helper type to ensure type safety when accessing directives
export type DirectiveArgs<T> = {
  [K in keyof T]: T[K] extends Array<infer U> ? U : never;
};

// Type guard for checking if user exists
export function isUserType(user: UserType | null): user is UserType {
  return user !== null && 'role' in user && 'username' in user && 'userId' in user;
}
