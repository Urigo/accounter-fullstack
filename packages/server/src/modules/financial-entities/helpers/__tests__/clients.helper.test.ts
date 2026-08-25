import { describe, expect, it, vi } from 'vitest';
import {
  ClientIntegrationsSchema,
  parseStoredClientIntegrations,
} from '../clients.helper.js';

/**
 * These are read-path regression guards, not schema tests.
 *
 * The stored parser used to be the strict one, which threw a `GraphQLError` on
 * anything it did not recognize. Because the `ClientIntegrations` field
 * resolvers run once per client, a single unreadable row failed the whole
 * `allClients` query — and the MCP connector discards partial data whenever a
 * response carries an `errors` entry, so a list call came back empty rather than
 * short. Every case below is a value that must degrade to "not configured".
 */
describe('parseStoredClientIntegrations', () => {
  const VALID = {
    greenInvoiceId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    hiveId: 'hive-1',
    linearId: 'lin-1',
    slackChannelKey: 'C123',
    notionId: 'notion-1',
    workflowyUrl: 'https://workflowy.com/#/abc',
  };

  it('round-trips a fully populated value', () => {
    expect(parseStoredClientIntegrations(VALID)).toEqual(VALID);
  });

  // The column is nullable, and `updateClient`'s COALESCE can land NULL.
  it.each([null, undefined])('treats %s as no integrations', input => {
    expect(parseStoredClientIntegrations(input)).toEqual({});
  });

  it('accepts an empty object', () => {
    expect(parseStoredClientIntegrations({})).toEqual({});
  });

  // Written by an older deploy, or left behind by a removed field.
  it('strips unknown keys instead of rejecting the record', () => {
    const parsed = parseStoredClientIntegrations({ hiveId: 'hive-1', legacyKey: 'x' });
    expect(parsed).toEqual({ hiveId: 'hive-1' });
  });

  // The point of the per-field `.catch(null)`: one bad value must not cost the
  // siblings that parsed fine.
  it('degrades a wrong-typed field to null and keeps the rest', () => {
    const parsed = parseStoredClientIntegrations({ greenInvoiceId: 'not-a-uuid', hiveId: 'hive-1' });
    expect(parsed.greenInvoiceId).toBeNull();
    expect(parsed.hiveId).toBe('hive-1');
  });

  it('returns no integrations when the stored value is not an object at all', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(parseStoredClientIntegrations('nonsense')).toEqual({});
      expect(parseStoredClientIntegrations(42)).toEqual({});
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('never throws, whatever it is handed', () => {
    for (const input of [null, undefined, '', 0, [], [1, 2], { a: 1 }, Symbol('x')]) {
      expect(() => parseStoredClientIntegrations(input)).not.toThrow();
    }
  });
});

/**
 * The strict schema stays available for a write path that wants to reject an
 * unrecognized key outright — that direction has the opposite failure cost, so
 * the two behaviours must not drift back together.
 */
describe('ClientIntegrationsSchema', () => {
  it('rejects an unknown key', () => {
    expect(ClientIntegrationsSchema.safeParse({ hiveId: 'h', nope: 1 }).success).toBe(false);
  });

  it('rejects null', () => {
    expect(ClientIntegrationsSchema.safeParse(null).success).toBe(false);
  });
});
