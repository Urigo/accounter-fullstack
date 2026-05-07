import { describe, expect, it } from 'vitest';
import { DeelPayloadSchema, GreenInvoicePayloadSchema } from '../payload-schemas.js';

describe('GreenInvoicePayloadSchema', () => {
  it('rejects an empty object', () => {
    expect(GreenInvoicePayloadSchema.safeParse({}).success).toBe(false);
  });

  it('rejects when id is empty string', () => {
    expect(GreenInvoicePayloadSchema.safeParse({ id: '', secret: 'sec' }).success).toBe(false);
  });

  it('rejects when secret is missing', () => {
    expect(GreenInvoicePayloadSchema.safeParse({ id: 'x' }).success).toBe(false);
  });

  it('rejects when secret is empty string', () => {
    expect(GreenInvoicePayloadSchema.safeParse({ id: 'x', secret: '' }).success).toBe(false);
  });

  it('accepts a valid payload', () => {
    expect(GreenInvoicePayloadSchema.safeParse({ id: 'my-id', secret: 'my-secret' }).success).toBe(
      true,
    );
  });
});

describe('DeelPayloadSchema', () => {
  it('rejects an empty object', () => {
    expect(DeelPayloadSchema.safeParse({}).success).toBe(false);
  });

  it('rejects when apiToken is empty string', () => {
    expect(DeelPayloadSchema.safeParse({ apiToken: '' }).success).toBe(false);
  });

  it('accepts a valid payload', () => {
    expect(DeelPayloadSchema.safeParse({ apiToken: 'my-token' }).success).toBe(true);
  });
});
