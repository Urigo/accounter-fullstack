export type AuthType = 'jwt' | 'apiKey' | 'system';

export interface AuthUser {
  userId: string;
  email: string;
  roleId: string;
  permissions: string[];
  emailVerified: boolean;
  permissionsVersion: number;
  auth0UserId?: string;
}

export interface TenantContext {
  businessId: string;
  businessName?: string;
  roleId?: string;
}

export interface AuthContext {
  authType: AuthType | null;
  token?: string | null;
  user?: AuthUser;
  tenant: TenantContext;
  accessTokenExpiresAt?: number;
}
