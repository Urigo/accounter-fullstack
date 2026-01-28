export interface AuthContext {
  authType: 'jwt' | 'apiKey';
  token: string | null;
  user: {
    userId: string;
    roleId: string;
    auth0UserId?: string;
  } | null;
  tenant: {
    businessId: string;
    roleId: string;
  };
}
