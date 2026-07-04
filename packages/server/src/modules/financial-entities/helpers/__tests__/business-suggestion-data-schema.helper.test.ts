import { describe, expect, it } from 'vitest';
import { suggestionDataSchema } from '../business-suggestion-data-schema.helper.js';

describe('suggestionDataSchema emails', () => {
  it('accepts concrete email addresses', () => {
    const result = suggestionDataSchema.safeParse({ emails: ['vendor@acme.com'] });
    expect(result.success).toBe(true);
  });

  it('accepts wildcard email patterns for per-invoice sender addresses', () => {
    const result = suggestionDataSchema.safeParse({
      emails: ['*@cloudflare.com', 'invoices+*@stripe.com'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a mix of concrete and wildcard entries', () => {
    const result = suggestionDataSchema.safeParse({
      emails: ['billing@vendor.com', '*@cloudflare.com'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an over-broad bare "*"', () => {
    const result = suggestionDataSchema.safeParse({ emails: ['*'] });
    expect(result.success).toBe(false);
  });

  it('rejects strings that are neither an email nor an email-shaped pattern', () => {
    const result = suggestionDataSchema.safeParse({ emails: ['not-an-email'] });
    expect(result.success).toBe(false);
  });
});
