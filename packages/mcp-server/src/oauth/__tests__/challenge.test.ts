import type { ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { buildWwwAuthenticateHeader, sendUnauthorized } from '../challenge.js';

const RESOURCE_METADATA_URL =
  'https://mcp.example.com/.well-known/oauth-protected-resource';

describe('buildWwwAuthenticateHeader', () => {
  it('includes the resource_metadata pointer', () => {
    expect(buildWwwAuthenticateHeader({ resourceMetadataUrl: RESOURCE_METADATA_URL })).toBe(
      `Bearer resource_metadata="${RESOURCE_METADATA_URL}"`,
    );
  });

  it('appends error and error_description when provided', () => {
    const header = buildWwwAuthenticateHeader({
      resourceMetadataUrl: RESOURCE_METADATA_URL,
      error: 'invalid_token',
      errorDescription: 'The access token expired',
    });
    expect(header).toBe(
      `Bearer resource_metadata="${RESOURCE_METADATA_URL}", error="invalid_token", error_description="The access token expired"`,
    );
  });
});

describe('sendUnauthorized', () => {
  function mockRes() {
    const res = {
      setHeader: vi.fn(() => res),
      writeHead: vi.fn(() => res),
      end: vi.fn(() => res),
    };
    return res as unknown as ServerResponse & {
      setHeader: ReturnType<typeof vi.fn>;
      writeHead: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
    };
  }

  it('sets WWW-Authenticate and writes a 401 JSON body', () => {
    const res = mockRes();
    sendUnauthorized(res, { resourceMetadataUrl: RESOURCE_METADATA_URL });

    expect(res.setHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      `Bearer resource_metadata="${RESOURCE_METADATA_URL}"`,
    );
    expect(res.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
    const body = JSON.parse(res.end.mock.calls[0][0] as string);
    expect(body.error).toBe('unauthorized');
    expect(typeof body.error_description).toBe('string');
  });

  it('propagates a specific error code into the body and header', () => {
    const res = mockRes();
    sendUnauthorized(res, {
      resourceMetadataUrl: RESOURCE_METADATA_URL,
      error: 'invalid_token',
      errorDescription: 'expired',
    });
    expect((res.setHeader.mock.calls[0][1] as string)).toContain('error="invalid_token"');
    const body = JSON.parse(res.end.mock.calls[0][0] as string);
    expect(body.error).toBe('invalid_token');
    expect(body.error_description).toBe('expired');
  });
});
