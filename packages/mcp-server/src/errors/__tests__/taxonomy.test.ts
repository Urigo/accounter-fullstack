import { describe, expect, it } from 'vitest';
import { TokenVerificationError } from '../../auth/token.js';
import { UpstreamError } from '../../upstream/graphql-client.js';
import {
  DEFAULT_RETRYABLE,
  errorPayload,
  isInternalError,
  McpError,
  RateLimitError,
  ToolInputError,
  toErrorPayload,
  toToolErrorResult,
} from '../taxonomy.js';

const CID = 'corr-1';

describe('errorPayload', () => {
  it('defaults retryability by code', () => {
    expect(errorPayload('TIMEOUT_ERROR', 'timed out', CID).retryable).toBe(true);
    expect(errorPayload('VALIDATION_ERROR', 'bad', CID).retryable).toBe(false);
  });

  it('honors an explicit retryable override and includes issues', () => {
    const payload = errorPayload('VALIDATION_ERROR', 'bad', CID, {
      retryable: true,
      issues: [{ path: 'x', message: 'required' }],
    });
    // VALIDATION_ERROR defaults to non-retryable; the explicit override wins.
    expect(payload.retryable).toBe(true);
    expect(payload.issues).toEqual([{ path: 'x', message: 'required' }]);
  });

  it('omits empty issues and absent retryAfterMs', () => {
    const payload = errorPayload('INTERNAL_ERROR', 'x', CID, { issues: [] });
    expect('issues' in payload).toBe(false);
    expect('retryAfterMs' in payload).toBe(false);
  });
});

describe('toErrorPayload — mapping every source', () => {
  it('passes through an McpError with its fields', () => {
    const payload = toErrorPayload(
      new McpError('AUTHORIZATION_ERROR', 'nope', { retryable: false }),
      CID,
    );
    expect(payload).toMatchObject({ code: 'AUTHORIZATION_ERROR', message: 'nope', retryable: false });
  });

  it('maps ToolInputError to VALIDATION_ERROR with issues', () => {
    const payload = toErrorPayload(new ToolInputError('bad range', [{ path: 'to', message: 'x' }]), CID);
    expect(payload.code).toBe('VALIDATION_ERROR');
    expect(payload.issues).toEqual([{ path: 'to', message: 'x' }]);
  });

  it('maps RateLimitError to RATE_LIMIT_ERROR with retryAfterMs', () => {
    const payload = toErrorPayload(new RateLimitError('slow down', 5000), CID);
    expect(payload).toMatchObject({ code: 'RATE_LIMIT_ERROR', retryable: true, retryAfterMs: 5000 });
  });

  it('maps UpstreamError preserving its code and retryability', () => {
    expect(toErrorPayload(new UpstreamError('TIMEOUT_ERROR', 'slow', true), CID)).toMatchObject({
      code: 'TIMEOUT_ERROR',
      retryable: true,
    });
    expect(toErrorPayload(new UpstreamError('UPSTREAM_ERROR', 'boom', false), CID)).toMatchObject({
      code: 'UPSTREAM_ERROR',
      retryable: false,
    });
  });

  it('maps a token verification failure to AUTHENTICATION_ERROR', () => {
    const payload = toErrorPayload(new TokenVerificationError('expired'), CID);
    expect(payload).toMatchObject({ code: 'AUTHENTICATION_ERROR', retryable: false });
  });

  it('maps an unknown error to a sanitized INTERNAL_ERROR (no leak)', () => {
    const payload = toErrorPayload(new Error('SELECT * FROM secrets failed at line 42'), CID);
    expect(payload.code).toBe('INTERNAL_ERROR');
    expect(payload.message).not.toContain('SELECT');
    expect(payload.correlationId).toBe(CID);
  });

  it('maps a non-Error throwable to INTERNAL_ERROR', () => {
    expect(toErrorPayload('boom', CID).code).toBe('INTERNAL_ERROR');
  });
});

describe('isInternalError', () => {
  it('is true only for unmapped errors', () => {
    expect(isInternalError(new Error('x'))).toBe(true);
    expect(isInternalError('x')).toBe(true);
    expect(isInternalError(new McpError('AUTHORIZATION_ERROR', 'x'))).toBe(false);
    expect(isInternalError(new UpstreamError('UPSTREAM_ERROR', 'x', false))).toBe(false);
    expect(isInternalError(new TokenVerificationError('x'))).toBe(false);
  });
});

describe('toToolErrorResult', () => {
  it('renders isError with a code-prefixed text and structured payload', () => {
    const result = toToolErrorResult(
      errorPayload('RATE_LIMIT_ERROR', 'slow down', CID, { retryAfterMs: 1000 }),
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('RATE_LIMIT_ERROR: slow down');
    expect(result.structuredContent).toMatchObject({
      code: 'RATE_LIMIT_ERROR',
      message: 'slow down',
      correlationId: CID,
      retryable: true,
      retryAfterMs: 1000,
    });
  });
});

describe('DEFAULT_RETRYABLE', () => {
  it('marks only transient failures retryable', () => {
    expect(DEFAULT_RETRYABLE.TIMEOUT_ERROR).toBe(true);
    expect(DEFAULT_RETRYABLE.RATE_LIMIT_ERROR).toBe(true);
    expect(DEFAULT_RETRYABLE.VALIDATION_ERROR).toBe(false);
    expect(DEFAULT_RETRYABLE.AUTHENTICATION_ERROR).toBe(false);
    expect(DEFAULT_RETRYABLE.AUTHORIZATION_ERROR).toBe(false);
    expect(DEFAULT_RETRYABLE.INTERNAL_ERROR).toBe(false);
  });
});
