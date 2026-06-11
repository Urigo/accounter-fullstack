import { describe, expect, it } from 'vitest';
import type { Environment } from '../../../../shared/types/index.js';
import { AuthContextProvider } from '../auth-context.provider.js';

const VALID_TOKEN = 'test-gateway-cp-token-abc123';

const envWithToken = {
  gatewayControlPlane: { token: VALID_TOKEN },
} as unknown as Environment;

const envWithoutToken = {
  gatewayControlPlane: { token: undefined },
} as unknown as Environment;

describe('AuthContextProvider gateway control-plane auth', () => {
  it('valid gateway CP token returns gatewayControlPlane authType', async () => {
    const provider = new AuthContextProvider(
      envWithToken,
      { authType: 'gatewayControlPlane', token: VALID_TOKEN },
      {} as never,
    );

    const context = await provider.getAuthContext();

    expect(context?.authType).toBe('gatewayControlPlane');
    expect(context?.user?.roleId).toBe('gateway_control_plane');
  });

  it('gateway CP context has no real tenant businessId', async () => {
    const provider = new AuthContextProvider(
      envWithToken,
      { authType: 'gatewayControlPlane', token: VALID_TOKEN },
      {} as never,
    );

    const context = await provider.getAuthContext();

    expect(context?.tenant.businessId).toBe('');
    expect(context?.memberships).toBeUndefined();
  });

  it('invalid gateway CP token returns null', async () => {
    const provider = new AuthContextProvider(
      envWithToken,
      { authType: 'gatewayControlPlane', token: 'wrong-token' },
      {} as never,
    );

    const context = await provider.getAuthContext();

    expect(context).toBeNull();
  });

  it('empty gateway CP token returns null', async () => {
    const provider = new AuthContextProvider(
      envWithToken,
      { authType: 'gatewayControlPlane', token: '' },
      {} as never,
    );

    const context = await provider.getAuthContext();

    expect(context).toBeNull();
  });

  it('missing GATEWAY_CP_TOKEN env config returns null', async () => {
    const provider = new AuthContextProvider(
      envWithoutToken,
      { authType: 'gatewayControlPlane', token: VALID_TOKEN },
      {} as never,
    );

    const context = await provider.getAuthContext();

    expect(context).toBeNull();
  });

  it('does not make DB queries for CP token validation', async () => {
    const mockDb = {
      query: () => {
        throw new Error('DB must not be called for gateway CP auth');
      },
    };

    const provider = new AuthContextProvider(
      envWithToken,
      { authType: 'gatewayControlPlane', token: VALID_TOKEN },
      mockDb as never,
    );

    await expect(provider.getAuthContext()).resolves.not.toThrow();
  });
});
