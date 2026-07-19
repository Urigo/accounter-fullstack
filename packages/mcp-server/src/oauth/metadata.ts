/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728).
 *
 * Claude clients discover how to authenticate to this MCP server by fetching
 * the well-known document served here. The document points at the Auth0
 * authorization server(s) and declares that bearer tokens are accepted via the
 * `Authorization` header only (never query params — see spec §6.5).
 */

/** Well-known path for the protected resource metadata document. */
export const PROTECTED_RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource';

/** Inputs for building the metadata document. Kept explicit for testability. */
export interface ProtectedResourceMetadataConfig {
  /** Canonical resource identifier — the MCP server's public base URL. */
  resource: string;
  /** Authorization server issuer URLs (Auth0). */
  authorizationServers: readonly string[];
}

/** Shape of the served metadata document (RFC 9728 subset). */
export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported: string[];
}

/**
 * Build the protected resource metadata document. Pure and config-driven — no
 * environment-specific values are hardcoded.
 */
export function buildProtectedResourceMetadata(
  config: ProtectedResourceMetadataConfig,
): ProtectedResourceMetadata {
  return {
    resource: config.resource,
    authorization_servers: [...config.authorizationServers],
    // Tokens are accepted only in the Authorization header, never query params.
    bearer_methods_supported: ['header'],
  };
}

/** Absolute URL of the metadata document, given the MCP public base URL. */
export function protectedResourceMetadataUrl(publicBaseUrl: string): string {
  return `${publicBaseUrl.replace(/\/+$/, '')}${PROTECTED_RESOURCE_METADATA_PATH}`;
}
