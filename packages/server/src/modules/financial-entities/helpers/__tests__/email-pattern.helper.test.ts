import { describe, expect, it } from 'vitest';
import {
  emailMatchesPattern,
  isValidWildcardEmailPattern,
  isWildcardEmailPattern,
} from '../email-pattern.helper.js';

describe('isWildcardEmailPattern', () => {
  it('is true only when a "*" is present', () => {
    expect(isWildcardEmailPattern('*@cloudflare.com')).toBe(true);
    expect(isWildcardEmailPattern('invoices+*@stripe.com')).toBe(true);
    expect(isWildcardEmailPattern('vendor@acme.com')).toBe(false);
  });
});

describe('isValidWildcardEmailPattern', () => {
  it('accepts email-shaped wildcard patterns', () => {
    expect(isValidWildcardEmailPattern('*@cloudflare.com')).toBe(true);
    expect(isValidWildcardEmailPattern('invoices+*@stripe.com')).toBe(true);
    expect(isValidWildcardEmailPattern('*@*.cloudflare.com')).toBe(true);
  });

  it('rejects over-broad or malformed wildcard patterns', () => {
    expect(isValidWildcardEmailPattern('*')).toBe(false);
    expect(isValidWildcardEmailPattern('*@cloudflare')).toBe(false); // no dotted domain
    expect(isValidWildcardEmailPattern('*cloudflare.com')).toBe(false); // no @
    expect(isValidWildcardEmailPattern('foo *@bar.com')).toBe(false); // whitespace
  });

  it('rejects plain addresses (they are validated as concrete emails elsewhere)', () => {
    expect(isValidWildcardEmailPattern('vendor@acme.com')).toBe(false);
  });
});

describe('emailMatchesPattern', () => {
  it('matches the unique-per-invoice address example from the issue', () => {
    expect(emailMatchesPattern('*@cloudflare.com', 'qr45uf@cloudflare.com')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(emailMatchesPattern('*@Cloudflare.com', 'QR45UF@CLOUDFLARE.COM')).toBe(true);
    expect(emailMatchesPattern('Vendor@Acme.com', 'vendor@acme.com')).toBe(true);
  });

  it('requires an exact match for non-wildcard patterns', () => {
    expect(emailMatchesPattern('vendor@acme.com', 'vendor@acme.com')).toBe(true);
    expect(emailMatchesPattern('vendor@acme.com', 'other@acme.com')).toBe(false);
  });

  it('does not let "*" cross into a different domain', () => {
    expect(emailMatchesPattern('*@cloudflare.com', 'qr45uf@notcloudflare.com')).toBe(false);
    expect(emailMatchesPattern('*@cloudflare.com', 'qr45uf@cloudflare.com.evil.com')).toBe(false);
  });

  it('supports a wildcard in the middle of the local part', () => {
    expect(emailMatchesPattern('invoices+*@stripe.com', 'invoices+abc123@stripe.com')).toBe(true);
    expect(emailMatchesPattern('invoices+*@stripe.com', 'receipts+abc@stripe.com')).toBe(false);
  });

  it('treats regex/LIKE metacharacters in the pattern as literals', () => {
    // "." must not act as a regex wildcard
    expect(emailMatchesPattern('a.b@acme.com', 'axb@acme.com')).toBe(false);
    // "_" must not act as a single-char wildcard
    expect(emailMatchesPattern('a_b@acme.com', 'axb@acme.com')).toBe(false);
    expect(emailMatchesPattern('a_b@acme.com', 'a_b@acme.com')).toBe(true);
  });
});
