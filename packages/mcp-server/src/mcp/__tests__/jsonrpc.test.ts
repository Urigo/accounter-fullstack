import { describe, expect, it } from 'vitest';
import {
  asJsonRpcRequest,
  failure,
  isNotification,
  JSON_RPC_VERSION,
  JsonRpcErrorCode,
  success,
} from '../jsonrpc.js';

describe('success / failure builders', () => {
  it('builds a success envelope', () => {
    expect(success(1, { ok: true })).toEqual({
      jsonrpc: JSON_RPC_VERSION,
      id: 1,
      result: { ok: true },
    });
  });

  it('builds an error envelope and omits absent data', () => {
    const err = failure('x', JsonRpcErrorCode.MethodNotFound, 'nope');
    expect(err).toEqual({
      jsonrpc: JSON_RPC_VERSION,
      id: 'x',
      error: { code: -32_601, message: 'nope' },
    });
    expect('data' in err.error).toBe(false);
  });

  it('includes data when provided', () => {
    const err = failure(null, JsonRpcErrorCode.InvalidParams, 'bad', { field: 'name' });
    expect(err.error.data).toEqual({ field: 'name' });
  });
});

describe('asJsonRpcRequest', () => {
  it('accepts a valid request', () => {
    expect(asJsonRpcRequest({ jsonrpc: '2.0', id: 1, method: 'ping' })).not.toBeNull();
  });

  it('accepts a notification (no id)', () => {
    const req = asJsonRpcRequest({ jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(req).not.toBeNull();
    expect(isNotification(req!)).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'hello'],
    ['wrong version', { jsonrpc: '1.0', method: 'ping' }],
    ['missing method', { jsonrpc: '2.0', id: 1 }],
    ['non-string method', { jsonrpc: '2.0', method: 42 }],
    ['object id', { jsonrpc: '2.0', id: {}, method: 'ping' }],
    ['primitive params', { jsonrpc: '2.0', id: 1, method: 'ping', params: 'oops' }],
  ])('rejects %s', (_label, value) => {
    expect(asJsonRpcRequest(value)).toBeNull();
  });

  it('accepts object and array params', () => {
    expect(asJsonRpcRequest({ jsonrpc: '2.0', id: 1, method: 'x', params: { a: 1 } })).not.toBeNull();
    expect(asJsonRpcRequest({ jsonrpc: '2.0', id: 1, method: 'x', params: [1, 2] })).not.toBeNull();
  });
});

describe('isNotification', () => {
  it('is true only when id is absent', () => {
    expect(isNotification({ jsonrpc: '2.0', method: 'x' })).toBe(true);
    expect(isNotification({ jsonrpc: '2.0', id: null, method: 'x' })).toBe(false);
    expect(isNotification({ jsonrpc: '2.0', id: 0, method: 'x' })).toBe(false);
  });
});
