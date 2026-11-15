import { describe, expect, it, vi } from 'vitest';
import type { Environment, RequestLogState } from '../../../../shared/types/index.js';
import type { DBProvider } from '../../../app-providers/db.provider.js';
import { AuthContextProvider } from '../auth-context.provider.js';

function requestLogState(): RequestLogState {
  return {
    startedAt: 0,
    requestId: 'req-1',
    correlationId: null,
    operationName: null,
    operationType: null,
    userId: null,
    businessId: null,
    executed: false,
    errorCount: 0,
    errorCodes: new Set(),
    logged: false,
  };
}

function apiKeyDb(rows: unknown[]) {
  return {
    query: vi.fn().mockResolvedValueOnce({ rows }).mockResolvedValue({ rows: [] }),
  } as unknown as DBProvider;
}

describe('AuthContextProvider request log identity', () => {
  it('records the user and business once auth resolves', async () => {
    const requestLog = requestLogState();
    const provider = new AuthContextProvider(
      {} as Environment,
      { authType: 'apiKey', token: 'plaintext-key' },
      apiKeyDb([{ id: 'key-1', business_id: 'business-1', role_id: 'scraper' }]),
      { requestLog } as unknown as GraphQLModules.GlobalContext,
    );

    await provider.getAuthContext();

    expect(requestLog.userId).toBe('api-key:key-1');
    expect(requestLog.businessId).toBe('business-1');
  });

  it('records nothing when auth fails', async () => {
    const requestLog = requestLogState();
    const provider = new AuthContextProvider(
      {} as Environment,
      { authType: 'apiKey', token: 'unknown-key' },
      apiKeyDb([]),
      { requestLog } as unknown as GraphQLModules.GlobalContext,
    );

    await expect(provider.getAuthContext()).resolves.toBeNull();

    expect(requestLog.userId).toBeNull();
    expect(requestLog.businessId).toBeNull();
  });

  it('records no business for a context without a tenant', async () => {
    const requestLog = requestLogState();
    const provider = new AuthContextProvider(
      { gatewayControlPlane: { token: 'cp-token' } } as unknown as Environment,
      { authType: 'gatewayControlPlane', token: 'cp-token' },
      {} as DBProvider,
      { requestLog } as unknown as GraphQLModules.GlobalContext,
    );

    await provider.getAuthContext();

    expect(requestLog.userId).toBe('gateway-control-plane');
    expect(requestLog.businessId).toBeNull();
  });
});
