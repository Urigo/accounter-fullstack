import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createBusinessTool } from '../businesses-write.js';
import { COUNTRY_CODES, normalizeCountryCode } from '../country-codes.js';
import {
  authContext,
  B1,
  B2,
  BIZ,
  callsTo,
  mutationClient,
  rootFields,
  runTool,
} from './review-write-harness.js';

const created = (overrides: Record<string, unknown> = {}) => ({
  __typename: 'LtdFinancialEntity',
  id: BIZ,
  name: 'Alamo Rent A Car',
  hebrewName: null,
  governmentId: null,
  website: null,
  country: { code: 'USA' },
  taxCategory: null,
  ...overrides,
});

/** Directory lookup finds nothing, then the insert succeeds. */
const fresh = (overrides: Record<string, unknown> = {}) =>
  mutationClient({ allBusinesses: { nodes: [] }, insertNewBusiness: created(overrides) });

describe('createBusinessTool — request', () => {
  it('looks the name up first, then sends the name, an upper-cased country and the given fields', async () => {
    const { client, captured } = fresh();
    const result = await runTool(
      createBusinessTool,
      {
        name: 'Alamo Rent A Car',
        country: 'usa',
        website: 'https://alamo.com',
        sortCode: 1200,
        taxCategoryId: 'tc-1',
        governmentId: '123456789',
        optionalVat: true,
        suggestions: { phrases: ['ALAMO RENT A CAR'], tagIds: ['tag-1'] },
      },
      client,
    );

    expect(result.isError).toBeUndefined();
    const order = rootFields(captured);
    expect(order).toEqual(['allBusinesses', 'insertNewBusiness']);
    expect(callsTo(captured, 'allBusinesses')[0].query).toMatch(/^\s*query\b/);
    expect(callsTo(captured, 'allBusinesses')[0].variables).toEqual({
      filters: { name: 'Alamo Rent A Car' },
    });
    const [insert] = callsTo(captured, 'insertNewBusiness');
    expect(insert.query).toMatch(/^\s*mutation\b/);
    expect(insert.variables).toEqual({
      fields: {
        name: 'Alamo Rent A Car',
        country: 'USA',
        website: 'https://alamo.com',
        sortCode: 1200,
        taxCategory: 'tc-1',
        governmentId: '123456789',
        optionalVAT: true,
        suggestions: { phrases: ['ALAMO RENT A CAR'], tags: [{ id: 'tag-1' }] },
      },
    });
    expect(insert.headers['x-business-scope']).toBe(B1);
  });
});

describe('createBusinessTool — guards', () => {
  it('rejects a country that is not in the CountryCode enum, before any round trip', async () => {
    const { client, captured } = fresh();
    for (const country of ['US', 'UKX', 'ENG']) {
      const result = await runTool(createBusinessTool, { name: 'Alamo', country }, client);
      expect(result.isError, country).toBe(true);
      const structured = result.structuredContent as {
        code: string;
        issues?: Array<{ path: string }>;
      };
      expect(structured.code).toBe('VALIDATION_ERROR');
      expect(structured.issues?.[0]?.path).toBe('country');
    }
    expect(captured).toHaveLength(0);
  });

  it('refuses a name that already exists and names the existing id', async () => {
    const { client, captured } = mutationClient({
      allBusinesses: { nodes: [{ id: 'b-existing', name: 'alamo rent a car' }] },
      insertNewBusiness: created(),
    });
    const result = await runTool(createBusinessTool, { name: 'Alamo Rent A Car', country: 'USA' }, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as {
      code: string;
      message: string;
      issues: Array<{ path: string; message: string }>;
    };
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(structured.message).toMatch(/already exists/);
    expect(structured.issues[0].message).toContain('b-existing');
    expect(callsTo(captured, 'insertNewBusiness')).toHaveLength(0);
  });

  it('ignores a near-miss name and creates when allowDuplicateName is set', async () => {
    const { client, captured } = mutationClient({
      allBusinesses: { nodes: [{ id: 'b-existing', name: 'Alamo Rent A Car' }] },
      insertNewBusiness: created(),
    });
    const result = await runTool(
      createBusinessTool,
      { name: 'Alamo Rent A Car', country: 'USA', allowDuplicateName: true },
      client,
    );

    expect(result.isError).toBeUndefined();
    expect(callsTo(captured, 'allBusinesses')).toHaveLength(0);
    expect(callsTo(captured, 'insertNewBusiness')).toHaveLength(1);
  });

  it('requires a name', async () => {
    const { client } = fresh();
    const result = await runTool(createBusinessTool, { country: 'USA' }, client);

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('refuses an ambiguous write target', async () => {
    const { client, captured } = fresh();
    const result = await runTool(
      createBusinessTool,
      { name: 'Alamo', country: 'USA' },
      client,
      authContext([B1, B2]),
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
    expect(captured).toHaveLength(0);
  });
});

describe('createBusinessTool — result mapping', () => {
  it('reports the new id both as businessId and in the echo', async () => {
    const { client } = fresh({
      hebrewName: 'אלאמו',
      website: 'https://alamo.com',
      taxCategory: { id: 'tc-1', name: 'Travel' },
    });
    const result = await runTool(
      createBusinessTool,
      { name: 'Alamo Rent A Car', country: 'USA', taxCategoryId: 'tc-1' },
      client,
    );

    const structured = result.structuredContent as {
      ok: boolean;
      action: string;
      businessId: string;
      setFields: string[];
      businesses: Array<Record<string, unknown>>;
    };
    expect(structured.ok).toBe(true);
    expect(structured.action).toBe('create_business');
    expect(structured.businessId).toBe(BIZ);
    expect(structured.setFields).toEqual(['name', 'country', 'taxCategory']);
    expect(structured.businesses).toEqual([
      {
        id: BIZ,
        name: 'Alamo Rent A Car',
        hebrewName: 'אלאמו',
        governmentId: null,
        website: 'https://alamo.com',
        country: 'USA',
        taxCategory: { id: 'tc-1', name: 'Travel' },
      },
    ]);
  });

  it('maps an upstream CommonError to a non-retryable upstream error', async () => {
    const { client } = mutationClient({
      allBusinesses: { nodes: [] },
      insertNewBusiness: { __typename: 'CommonError', message: 'Failed to create core business' },
    });
    const result = await runTool(createBusinessTool, { name: 'Alamo', country: 'USA' }, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; retryable: boolean };
    expect(structured.code).toBe('UPSTREAM_ERROR');
    expect(structured.retryable).toBe(false);
  });
});

describe('country codes', () => {
  it('is well-formed and free of duplicates', () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    for (const code of COUNTRY_CODES) {
      expect(code).toMatch(/^[A-Z]{3}$/);
    }
  });

  it('mirrors the server CountryCode enum exactly', () => {
    // The upstream `CountryCode` scalar is opaque in schema.graphql, so the
    // tool's list is a copy of the server enum; this is what keeps the copy
    // honest when a code is added or corrected there.
    const enumsPath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../../server/src/shared/enums.ts',
    );
    if (!existsSync(enumsPath)) {
      throw new Error(`server enums not found at ${enumsPath}`);
    }
    const source = readFileSync(enumsPath, 'utf8');
    const block = source.match(/export enum CountryCode \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const serverCodes = [...block.matchAll(/=\s*'([A-Z]{3})'/g)].map(m => m[1]);
    expect(serverCodes.length).toBeGreaterThan(200);
    expect([...COUNTRY_CODES].sort()).toEqual([...serverCodes].sort());
  });

  it('normalizes case and rejects unknown codes', () => {
    expect(normalizeCountryCode(' isr ')).toBe('ISR');
    expect(normalizeCountryCode('usa')).toBe('USA');
    expect(normalizeCountryCode('UKX')).toBeNull();
    expect(normalizeCountryCode('IL')).toBeNull();
  });
});
