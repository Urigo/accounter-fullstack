import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import {
  DATA_MODEL_GUIDE,
  DATA_MODEL_GUIDE_TOOL_NAME,
  dataModelGuideTool,
} from '../data-model-guide.js';
import { KNOWN_CHARGE_TYPENAMES, chargeTypeFromTypename } from '../entity-shapes.js';
import { executeRegisteredTool } from '../execute.js';
import { toolRegistry } from '../registry-instance.js';

/**
 * The guide is static text, so the interesting failure mode is not "does it
 * render" but **drift**: it names tools, charge types and fields, and a rename
 * elsewhere would silently leave the model reading instructions for a surface
 * that no longer exists. These tests pin it to the code it describes.
 */

const PRINCIPAL: AuthPrincipal = {
  subject: 'user-1',
  issuer: 'https://tenant.auth0.com/',
  audience: 'aud',
  scopes: [],
  email: null,
  expiresAt: undefined,
  claims: { sub: 'user-1' },
};

function authContext(businessIds: string[]): McpAuthContext {
  return buildAuthContext(
    PRINCIPAL,
    businessIds.map(businessId => ({ businessId, roleId: 'accountant' })),
  );
}

/** Fails the test if anything reaches upstream — the handler must be pure. */
function forbiddenClient() {
  const fetchImpl = vi.fn(async () => {
    throw new Error('the data-model guide must not call upstream');
  });
  return new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

function run(auth: McpAuthContext, rawArgs: unknown = {}) {
  return executeRegisteredTool({
    tool: dataModelGuideTool,
    rawArgs,
    auth,
    correlationId: 'corr-1',
    client: forbiddenClient(),
    authorization: 'Bearer tok',
  });
}

describe('dataModelGuideTool', () => {
  it('returns the guide as text and structured content without calling upstream', async () => {
    const result = await run(authContext(['b1']));

    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toBe(DATA_MODEL_GUIDE);
    const structured = result.structuredContent as { guide: string; version: string };
    expect(structured.guide).toBe(DATA_MODEL_GUIDE);
    expect(structured.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  // This is the point of the tool: it has to be readable at cold start, before
  // the model knows which business it is working with — or whether it has one.
  it('works for a caller with no memberships at all', async () => {
    const result = await run(authContext([]));
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toBe(DATA_MODEL_GUIDE);
  });

  it('rejects unknown arguments', async () => {
    const result = await run(authContext(['b1']), { businessId: 'b1' });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('is registered ahead of every data tool', () => {
    const order = toolRegistry.describe().map(tool => tool.name);
    const guideIndex = order.indexOf(DATA_MODEL_GUIDE_TOOL_NAME);
    expect(guideIndex).toBeGreaterThanOrEqual(0);
    expect(guideIndex).toBeLessThan(order.indexOf('accounter_list_accounts'));
    expect(guideIndex).toBeLessThan(order.indexOf('accounter_search_charges'));
  });
});

describe('data-model guide content stays in sync', () => {
  // A tool rename would leave the guide telling the model to call something that
  // does not exist — the single most likely way this text goes stale.
  it('only references tools that are actually registered', () => {
    const registered = new Set(toolRegistry.list().map(tool => tool.name));
    const referenced = [...DATA_MODEL_GUIDE.matchAll(/accounter_[a-z_]+/g)].map(match => match[0]);

    expect(referenced.length).toBeGreaterThan(0);
    for (const name of new Set(referenced)) {
      expect(registered.has(name), `guide references unregistered tool ${name}`).toBe(true);
    }
  });

  it('documents every charge type the connector can emit', () => {
    const chargeTypes = KNOWN_CHARGE_TYPENAMES.map(typename => chargeTypeFromTypename(typename)!);
    expect(chargeTypes.length).toBeGreaterThan(0);
    for (const chargeType of chargeTypes) {
      expect(DATA_MODEL_GUIDE, `guide omits chargeType ${chargeType}`).toContain(chargeType);
    }
  });

  it('documents every account type', () => {
    for (const accountType of [
      'BANK_ACCOUNT',
      'BANK_DEPOSIT_ACCOUNT',
      'CREDIT_CARD',
      'CRYPTO_WALLET',
      'FOREIGN_SECURITIES',
    ]) {
      expect(DATA_MODEL_GUIDE).toContain(accountType);
    }
  });

  // The traps the feedback session actually fell into. If a future edit trims
  // the guide, these are the sentences that must survive.
  it('keeps the warnings that cost the most to rediscover', () => {
    // Card rows are settled again by a bank row.
    expect(DATA_MODEL_GUIDE).toMatch(/double-count/i);
    // Internal transfers are neither income nor expense.
    expect(DATA_MODEL_GUIDE).toContain('internal_transfer');
    // Securities rows have no mirror leg.
    expect(DATA_MODEL_GUIDE).toMatch(/single-legged/i);
    // Per-transaction balances are unavailable, and cumulativeNet is not one.
    expect(DATA_MODEL_GUIDE).toContain('cumulativeNet');
    expect(DATA_MODEL_GUIDE).toMatch(/balances are not available/i);
    // Historical, not present-day, exchange rates.
    expect(DATA_MODEL_GUIDE).toContain('exchangeRate');
    // Overlap-vs-containment date semantics.
    expect(DATA_MODEL_GUIDE).toContain('fromAnyDate');
  });

  // The whole guide is prompt budget the model pays on every read, and it is
  // cheap to keep appending to. Currently ~5.8KB; this is the ceiling before an
  // edit should be trading content out rather than adding.
  it('stays within its prompt budget', () => {
    expect(Buffer.byteLength(DATA_MODEL_GUIDE, 'utf8')).toBeLessThan(6_500);
  });
});
