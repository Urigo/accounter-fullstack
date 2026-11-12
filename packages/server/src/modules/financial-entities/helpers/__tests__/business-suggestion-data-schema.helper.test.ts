import { describe, expect, it } from 'vitest';
import {
  normalizeSuggestionListData,
  suggestionDataSchema,
} from '../business-suggestion-data-schema.helper.js';

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

  it('rejects an over-broad wildcard domain like "*@*.com"', () => {
    const result = suggestionDataSchema.safeParse({ emails: ['*@*.com'] });
    expect(result.success).toBe(false);
  });

  it('rejects strings that are neither an email nor an email-shaped pattern', () => {
    const result = suggestionDataSchema.safeParse({ emails: ['not-an-email'] });
    expect(result.success).toBe(false);
  });
});

describe('normalizeSuggestionListData', () => {
  it('drops duplicate recognition emails (case-insensitive)', () => {
    expect(normalizeSuggestionListData({ emails: ['vendor@acme.com', 'Vendor@Acme.com'] })).toEqual({
      emails: ['vendor@acme.com'],
    });
  });

  it('drops exactly repeated phrases', () => {
    expect(normalizeSuggestionListData({ phrases: ['GOOGLE', 'AMAZON', 'GOOGLE'] })).toEqual({
      phrases: ['GOOGLE', 'AMAZON'],
    });
  });

  // Phrases match via a case-sensitive `description.includes(phrase)`, so dropping
  // an overlapping or case-variant phrase would change which transactions match.
  it.each([
    [['GOOGL', 'GOOGLE']],
    [['AMAZON', 'AMAZON UK']],
    [['Google', 'GOOGLE ADS']],
    [['GOOGLE', 'Google']],
  ])('keeps overlapping and case-variant phrases %j', phrases => {
    expect(normalizeSuggestionListData({ phrases })).toEqual({ phrases });
  });

  it('drops exactly repeated internal email links', () => {
    expect(
      normalizeSuggestionListData({
        emailListener: { internalEmailLinks: ['https://x.com/a', 'https://x.com/a'] },
      }),
    ).toEqual({ emailListener: { internalEmailLinks: ['https://x.com/a'] } });
  });

  it('keeps internal email links that differ only in case', () => {
    const input = { emailListener: { internalEmailLinks: ['https://x.com/A', 'https://x.com/a'] } };
    expect(normalizeSuggestionListData(input)).toEqual(input);
  });

  it('leaves distinct phrases and emails untouched', () => {
    const input = { phrases: ['GOOGLE', 'AMAZON'], emails: ['a@x.com', 'b@x.com'] };
    expect(normalizeSuggestionListData(input)).toEqual(input);
  });
});
