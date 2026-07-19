import type { ServerResponse } from 'node:http';

/**
 * Standardized 401 challenge for MCP auth discovery.
 *
 * When a request is unauthenticated, the server must respond with `401` and a
 * `WWW-Authenticate: Bearer` header carrying a `resource_metadata` pointer to
 * the protected-resource metadata document (RFC 9728 §5.1 / spec §6.2). Claude
 * follows that pointer to begin the OAuth flow.
 *
 * This is a transport-level challenge — never a JSON-RPC/tool-level error.
 */
export interface UnauthorizedOptions {
  /** Absolute URL of the protected-resource metadata document. */
  resourceMetadataUrl: string;
  /** Optional RFC 6750 error code (e.g. `invalid_token`). */
  error?: string;
  /** Optional human-readable description (must be safe for end users). */
  errorDescription?: string;
}

/** Build the `WWW-Authenticate` header value for a bearer challenge. */
export function buildWwwAuthenticateHeader(options: UnauthorizedOptions): string {
  const params = [`resource_metadata="${options.resourceMetadataUrl}"`];
  if (options.error) {
    params.push(`error="${options.error}"`);
  }
  if (options.errorDescription) {
    params.push(`error_description="${options.errorDescription}"`);
  }
  return `Bearer ${params.join(', ')}`;
}

/**
 * Write a standards-compliant 401 challenge to the response, including the
 * `WWW-Authenticate` header with the `resource_metadata` pointer.
 */
export function sendUnauthorized(res: ServerResponse, options: UnauthorizedOptions): void {
  res.setHeader('WWW-Authenticate', buildWwwAuthenticateHeader(options));
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      error: options.error ?? 'unauthorized',
      error_description: options.errorDescription ?? 'Authentication required',
    }),
  );
}
