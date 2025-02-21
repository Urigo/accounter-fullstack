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

export interface ValidateUserType {
  parentType: GraphQLObjectType | GraphQLInterfaceType;
  fieldDirectives?: {
    auth?: AuthDirective[];
    [key: string]: unknown[] | undefined;
  };
  user: UserType | null | undefined | Record<string, unknown>;
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
