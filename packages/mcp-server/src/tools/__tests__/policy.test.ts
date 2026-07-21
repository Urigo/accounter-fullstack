import { describe, expect, it } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { authorizeToolCall, evaluateToolPolicy } from '../policy.js';
import type { ToolAuthPolicy, ToolDefinition } from '../registry.js';

function authContext(
  memberships: Array<{ businessId: string; roleId: string }>,
  scopes: string[] = [],
): McpAuthContext {
  const principal: AuthPrincipal = {
    subject: 'user-1',
    issuer: 'https://tenant.auth0.com/',
    audience: 'aud',
    scopes,
    email: null,
    expiresAt: undefined,
    claims: { sub: 'user-1' },
  };
  return buildAuthContext(principal, memberships);
}

const M = (businessId: string) => ({ businessId, roleId: 'accountant' });

const scopedPolicy: ToolAuthPolicy = {
  requiresBusinessScope: true,
  dataClassification: 'business',
};

describe('evaluateToolPolicy — business scope', () => {
  it('allows and defaults to all memberships when no scope is requested', () => {
    const decision = evaluateToolPolicy({
      policy: scopedPolicy,
      auth: authContext([M('b1'), M('b2')]),
    });
    expect(decision).toEqual({ allowed: true, readScope: { businessIds: ['b1', 'b2'] } });
  });

  it('allows a caller-narrowed subset', () => {
    const decision = evaluateToolPolicy({
      policy: scopedPolicy,
      auth: authContext([M('b1'), M('b2'), M('b3')]),
      requestedBusinessIds: ['b3', 'b1'],
    });
    expect(decision).toEqual({ allowed: true, readScope: { businessIds: ['b3', 'b1'] } });
  });

  it('denies a requested scope outside the memberships', () => {
    const decision = evaluateToolPolicy({
      policy: scopedPolicy,
      auth: authContext([M('b1')]),
      requestedBusinessIds: ['b1', 'bX'],
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.error.code).toBe('AUTHORIZATION_ERROR');
      expect(decision.error.message).toMatch(/outside your authorized memberships/);
    }
  });

  it('denies when the tool requires business scope but the caller has none', () => {
    const decision = evaluateToolPolicy({ policy: scopedPolicy, auth: authContext([]) });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.error.message).toMatch(/No authorized business scope/);
    }
  });
});

describe('evaluateToolPolicy — roles', () => {
  const roleScopedPolicy: ToolAuthPolicy = {
    requiredRoles: ['read:reports', 'admin'],
    requiresBusinessScope: false,
    dataClassification: 'business',
  };

  it('allows when the caller holds one of the required roles (any-of)', () => {
    const decision = evaluateToolPolicy({
      policy: roleScopedPolicy,
      auth: authContext([M('b1')], ['read:reports']),
    });
    expect(decision.allowed).toBe(true);
  });

  it('denies when the caller holds none of the required roles', () => {
    const decision = evaluateToolPolicy({
      policy: roleScopedPolicy,
      auth: authContext([M('b1')], ['read:charges']),
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.error.message).toMatch(/missing a required role/);
    }
  });

  it('applies no role gate when requiredRoles is omitted', () => {
    const decision = evaluateToolPolicy({
      policy: { requiresBusinessScope: false, dataClassification: 'public' },
      auth: authContext([], []),
    });
    expect(decision).toEqual({ allowed: true, readScope: { businessIds: [] } });
  });
});

describe('authorizeToolCall', () => {
  it('evaluates the policy of a registered tool', () => {
    const tool = {
      name: 't',
      description: 'd',
      inputSchema: undefined as never,
      policy: scopedPolicy,
      handler: () => ({ content: [] }),
    } as unknown as ToolDefinition;

    const decision = authorizeToolCall(tool, authContext([M('b1')]), ['b1']);
    expect(decision).toEqual({ allowed: true, readScope: { businessIds: ['b1'] } });
  });
});
