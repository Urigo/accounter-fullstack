import { describe, expect, it } from 'vitest';
import {
  buildProtectedResourceMetadata,
  PROTECTED_RESOURCE_METADATA_PATH,
  protectedResourceMetadataUrl,
} from '../metadata.js';

describe('buildProtectedResourceMetadata', () => {
  it('sets resource to the MCP public base URL exactly', () => {
    const doc = buildProtectedResourceMetadata({
      resource: 'https://mcp.example.com',
      authorizationServers: ['https://tenant.auth0.com/'],
    });
    expect(doc.resource).toBe('https://mcp.example.com');
  });

  it('lists the authorization servers', () => {
    const doc = buildProtectedResourceMetadata({
      resource: 'https://mcp.example.com',
      authorizationServers: ['https://tenant.auth0.com/'],
    });
    expect(doc.authorization_servers).toEqual(['https://tenant.auth0.com/']);
  });

  it('declares header-only bearer methods (no query-param tokens)', () => {
    const doc = buildProtectedResourceMetadata({
      resource: 'https://mcp.example.com',
      authorizationServers: ['https://tenant.auth0.com/'],
    });
    expect(doc.bearer_methods_supported).toEqual(['header']);
  });

  it('produces a stable document shape', () => {
    const doc = buildProtectedResourceMetadata({
      resource: 'https://mcp.example.com',
      authorizationServers: ['https://tenant.auth0.com/'],
    });
    expect(Object.keys(doc).sort()).toEqual([
      'authorization_servers',
      'bearer_methods_supported',
      'resource',
    ]);
  });

  it('copies the authorization servers (no shared reference)', () => {
    const servers = ['https://tenant.auth0.com/'];
    const doc = buildProtectedResourceMetadata({ resource: 'https://x', authorizationServers: servers });
    expect(doc.authorization_servers).not.toBe(servers);
  });
});

describe('protectedResourceMetadataUrl', () => {
  it('joins the public base URL with the well-known path', () => {
    expect(protectedResourceMetadataUrl('https://mcp.example.com')).toBe(
      `https://mcp.example.com${PROTECTED_RESOURCE_METADATA_PATH}`,
    );
  });

  it('normalizes a trailing slash on the base URL', () => {
    expect(protectedResourceMetadataUrl('https://mcp.example.com/')).toBe(
      `https://mcp.example.com${PROTECTED_RESOURCE_METADATA_PATH}`,
    );
  });
});
