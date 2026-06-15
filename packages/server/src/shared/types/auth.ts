export type AuthType = 'jwt' | 'apiKey' | 'system' | 'devBypass' | 'gatewayControlPlane';

export interface AuthUser {
  userId: string;
  email: string;
  roleId: string;
  permissions: string[];
  emailVerified: boolean;
  permissionsVersion: number;
  auth0UserId?: string | null;
}

export interface TenantContext {
  businessId: string;
  businessName?: string;
  roleId?: string;
}

/**
 * A single business a user belongs to, with the role they hold in it.
 * The multi-business migration resolves all of a user's memberships rather
 * than collapsing to a single active business.
 */
export interface BusinessMembership {
  businessId: string;
  roleId: string;
  businessName?: string;
}

/**
 * The set of businesses a request is authorized to read from. Defaults to all
 * of the user's memberships and can be narrowed (never broadened) per request.
 */
export interface AuthorizedReadScope {
  businessIds: string[];
}

/** A malformed entry in the `X-Business-Scope` request header. */
export type BusinessScopeParseError =
  | { code: 'EMPTY_ENTRY' }
  | { code: 'INVALID_UUID'; value: string };

/**
 * Result of parsing the `X-Business-Scope` header.
 * - `absent`: header missing or blank — no narrowing requested.
 * - `valid`: a de-duplicated, order-preserving list of business ids.
 * - `invalid`: one or more malformed entries.
 */
export type BusinessScopeParseResult =
  | { kind: 'absent' }
  | { kind: 'valid'; businessIds: string[] }
  | { kind: 'invalid'; errors: BusinessScopeParseError[] };

export interface AuthContext {
  authType: AuthType | null;
  token?: string | null;
  user?: AuthUser;
  tenant: TenantContext;
  /**
   * All businesses the authenticated user belongs to. Optional during the
   * multi-business migration; populated once membership resolution lands.
   */
  memberships?: BusinessMembership[];
  /**
   * The resolved read scope for the current request. Optional during the
   * migration; populated once scope plumbing lands.
   */
  activeReadScope?: AuthorizedReadScope;
  accessTokenExpiresAt?: number;
}
