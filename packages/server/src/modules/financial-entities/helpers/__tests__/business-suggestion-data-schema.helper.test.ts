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

  it('drops duplicate phrases (case-insensitive)', () => {
    expect(normalizeSuggestionListData({ phrases: ['GOOGLE', 'google'] })).toEqual({
      phrases: ['GOOGLE'],
    });
  });

  it('drops a phrase that is a substring of another, keeping the more specific one', () => {
    expect(normalizeSuggestionListData({ phrases: ['GOOGL', 'GOOGLE'] })).toEqual({
      phrases: ['GOOGLE'],
    });
  });

  it('drops duplicate internal email links', () => {
    expect(
      normalizeSuggestionListData({
        emailListener: { internalEmailLinks: ['https://x.com/a', 'https://x.com/a'] },
      }),
    ).toEqual({ emailListener: { internalEmailLinks: ['https://x.com/a'] } });
  });

  it('leaves distinct, non-overlapping phrases and emails untouched', () => {
    const input = { phrases: ['GOOGLE', 'AMAZON'], emails: ['a@x.com', 'b@x.com'] };
    expect(normalizeSuggestionListData(input)).toEqual(input);
  });
});
