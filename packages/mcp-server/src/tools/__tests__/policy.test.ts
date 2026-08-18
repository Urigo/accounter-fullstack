import { describe, expect, it } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { authorizeToolCall, evaluateToolPolicy } from '../policy.js';
import type { ToolAuthPolicy, ToolDefinition } from '../registry.js';

function authContext(memberships: Array<{ memberBusinessId: string; roleId: string }>): McpAuthContext {
  const principal: AuthPrincipal = {
    subject: 'user-1',
    issuer: 'https://tenant.auth0.com/',
    audience: 'aud',
    // Coarse OAuth transport scopes only — business roles are never read from
    // the token, they ride on the memberships resolved upstream (spec §6.4/§7.1).
    scopes: ['openid'],
    email: null,
    expiresAt: undefined,
    claims: { sub: 'user-1' },
  };
  return buildAuthContext(principal, memberships);
}

const M = (memberBusinessId: string, roleId = 'accountant') => ({ memberBusinessId, roleId });

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
    expect(decision).toEqual({ allowed: true, readScope: { memberBusinessIds: ['b1', 'b2'] } });
  });

  it('allows a caller-narrowed subset', () => {
    const decision = evaluateToolPolicy({
      policy: scopedPolicy,
      auth: authContext([M('b1'), M('b2'), M('b3')]),
      requestedMemberBusinessIds: ['b3', 'b1'],
    });
    expect(decision).toEqual({ allowed: true, readScope: { memberBusinessIds: ['b3', 'b1'] } });
  });

  it('denies a requested scope outside the memberships', () => {
    const decision = evaluateToolPolicy({
      policy: scopedPolicy,
      auth: authContext([M('b1')]),
      requestedMemberBusinessIds: ['b1', 'bX'],
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
    requiredRoles: ['accountant', 'admin'],
    requiresBusinessScope: false,
    dataClassification: 'business',
  };

  it('allows when the caller holds one of the required roles (any-of)', () => {
    const decision = evaluateToolPolicy({
      policy: roleScopedPolicy,
      auth: authContext([M('b1', 'accountant')]),
    });
    expect(decision.allowed).toBe(true);
  });

  it('denies when the caller holds none of the required roles', () => {
    const decision = evaluateToolPolicy({
      policy: roleScopedPolicy,
      auth: authContext([M('b1', 'viewer')]),
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.error.message).toMatch(/missing a required role/);
    }
  });

  it('applies no role gate when requiredRoles is omitted', () => {
    const decision = evaluateToolPolicy({
      policy: { requiresBusinessScope: false, dataClassification: 'public' },
      auth: authContext([]),
    });
    expect(decision).toEqual({ allowed: true, readScope: { memberBusinessIds: [] } });
  });
});

describe('evaluateToolPolicy — mutating tools', () => {
  const writePolicy: ToolAuthPolicy = {
    requiresBusinessScope: true,
    dataClassification: 'business',
    mutating: true,
  };

  it('allows a caller whose only membership is the write target', () => {
    const decision = evaluateToolPolicy({ policy: writePolicy, auth: authContext([M('b1')]) });
    expect(decision).toEqual({ allowed: true, readScope: { memberBusinessIds: ['b1'] } });
  });

  it('allows a multi-member caller who names one target', () => {
    const decision = evaluateToolPolicy({
      policy: writePolicy,
      auth: authContext([M('b1'), M('b2')]),
      requestedMemberBusinessIds: ['b2'],
    });
    expect(decision).toEqual({ allowed: true, readScope: { memberBusinessIds: ['b2'] } });
  });

  it('denies when the scope is ambiguous, rather than picking one', () => {
    const decision = evaluateToolPolicy({
      policy: writePolicy,
      auth: authContext([M('b1'), M('b2')]),
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.error.code).toBe('AUTHORIZATION_ERROR');
      // The message names the count so the caller knows to narrow, not retry.
      expect(decision.error.message).toMatch(/exactly one business, but the request resolved to 2/);
      expect(decision.error.message).toMatch(/memberBusinessId/);
    }
  });

  it('denies a caller narrowing to more than one target', () => {
    const decision = evaluateToolPolicy({
      policy: writePolicy,
      auth: authContext([M('b1'), M('b2')]),
      requestedMemberBusinessIds: ['b1', 'b2'],
    });
    expect(decision.allowed).toBe(false);
  });

  it('denies a caller with no memberships', () => {
    const decision = evaluateToolPolicy({ policy: writePolicy, auth: authContext([]) });
    expect(decision.allowed).toBe(false);
  });

  it('leaves non-mutating tools free to span every membership', () => {
    const decision = evaluateToolPolicy({
      policy: { ...writePolicy, mutating: false },
      auth: authContext([M('b1'), M('b2')]),
    });
    expect(decision.allowed).toBe(true);
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
    expect(decision).toEqual({ allowed: true, readScope: { memberBusinessIds: ['b1'] } });
  });
});
