import { describe, expect, it } from 'vitest';
import { createBusinessTool } from '../businesses-write.js';
import { authContext, B1, B2, BIZ, mutationClient, runTool } from './review-write-harness.js';

const created = (overrides: Record<string, unknown> = {}) => ({
  __typename: 'LtdFinancialEntity',
  id: BIZ,
  name: 'Alamo Rent A Car',
  hebrewName: null,
  website: null,
  country: { code: 'USA' },
  ...overrides,
});

describe('createBusinessTool — request', () => {
  it('sends the name and an upper-cased country, plus only the optional fields given', async () => {
    const { client, captured } = mutationClient('insertNewBusiness', created());
    const result = await runTool(
      createBusinessTool,
      { name: 'Alamo Rent A Car', country: 'usa', website: 'https://alamo.com' },
      client,
    );

    expect(result.isError).toBeUndefined();
    expect(captured).toHaveLength(1);
    expect(captured[0].query).toMatch(/^\s*mutation\b/);
    expect(captured[0].variables).toEqual({
      fields: { name: 'Alamo Rent A Car', country: 'USA', website: 'https://alamo.com' },
    });
    expect(captured[0].headers['x-business-scope']).toBe(B1);
  });
});

describe('createBusinessTool — guards', () => {
  it('rejects a country that is not a three-letter code', async () => {
    const { client, captured } = mutationClient('insertNewBusiness', created());
    const result = await runTool(createBusinessTool, { name: 'Alamo', country: 'US' }, client);

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
    expect(captured).toHaveLength(0);
  });

  it('requires a name', async () => {
    const { client } = mutationClient('insertNewBusiness', created());
    const result = await runTool(createBusinessTool, { country: 'USA' }, client);

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('refuses an ambiguous write target', async () => {
    const { client, captured } = mutationClient('insertNewBusiness', created());
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
    const { client } = mutationClient(
      'insertNewBusiness',
      created({ hebrewName: 'אלאמו', website: 'https://alamo.com' }),
    );
    const result = await runTool(createBusinessTool, { name: 'Alamo Rent A Car', country: 'USA' }, client);

    const structured = result.structuredContent as {
      ok: boolean;
      action: string;
      businessId: string;
      businesses: Array<Record<string, unknown>>;
    };
    expect(structured.ok).toBe(true);
    expect(structured.action).toBe('create_business');
    expect(structured.businessId).toBe(BIZ);
    expect(structured.businesses).toEqual([
      {
        id: BIZ,
        name: 'Alamo Rent A Car',
        hebrewName: 'אלאמו',
        website: 'https://alamo.com',
        country: 'USA',
      },
    ]);
  });

  it('maps an upstream CommonError to a non-retryable upstream error', async () => {
    const { client } = mutationClient('insertNewBusiness', {
      __typename: 'CommonError',
      message: 'Country is required to create a new business',
    });
    const result = await runTool(createBusinessTool, { name: 'Alamo', country: 'USA' }, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; retryable: boolean };
    expect(structured.code).toBe('UPSTREAM_ERROR');
    expect(structured.retryable).toBe(false);
  });
});
