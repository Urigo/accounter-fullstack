import { describe, expect, it } from 'vitest';
import {
  selectIssuerCandidates,
  selectIssuerEmail,
} from '../helpers/email-ingestion-issuer.helper.js';

describe('selectIssuerEmail', () => {
  it('returns null for missing evidence', () => {
    expect(selectIssuerEmail(undefined)).toBeNull();
    expect(selectIssuerEmail(null)).toBeNull();
    expect(selectIssuerEmail({})).toBeNull();
  });

  it('prefers a non-provider body candidate over headers', () => {
    expect(
      selectIssuerEmail({
        from: 'forwarder@gmail.com',
        replyTo: 'reply@x.com',
        issuerCandidates: ['vendor@acme.com'],
      }),
    ).toBe('vendor@acme.com');
  });

  it('skips a provider body candidate when a Reply-To exists', () => {
    expect(
      selectIssuerEmail({
        from: 'vendor@acme.com',
        replyTo: 'reply@x.com',
        issuerCandidates: ['notify@morning.co'],
      }),
    ).toBe('vendor@acme.com');
  });

  it('keeps a provider body candidate when there is no Reply-To', () => {
    expect(
      selectIssuerEmail({
        from: 'forwarder@gmail.com',
        issuerCandidates: ['notify@morning.co'],
      }),
    ).toBe('notify@morning.co');
  });

  it('returns the first non-provider candidate, scanning in order', () => {
    expect(
      selectIssuerEmail({
        replyTo: 'reply@x.com',
        issuerCandidates: ['c@sumit.co.il', 'real-issuer@vendor.com'],
      }),
    ).toBe('real-issuer@vendor.com');
  });

  it('falls back to originalFrom before from', () => {
    expect(
      selectIssuerEmail({
        from: 'forwarder@gmail.com',
        originalFrom: 'vendor@acme.com',
      }),
    ).toBe('vendor@acme.com');
  });

  it('falls back to Reply-To when from is a known provider', () => {
    expect(
      selectIssuerEmail({
        from: 'notify@morning.co',
        replyTo: 'reply@x.com',
      }),
    ).toBe('reply@x.com');
  });

  it('falls back to from when nothing else is usable', () => {
    expect(selectIssuerEmail({ from: 'notify@morning.co' })).toBe('notify@morning.co');
  });

  it('extracts the bare address from a "Name <addr>" form', () => {
    expect(selectIssuerEmail({ from: 'Acme Billing <billing@acme.com>' })).toBe('billing@acme.com');
  });

  it('ignores empty/null candidates', () => {
    expect(
      selectIssuerEmail({
        from: 'vendor@acme.com',
        issuerCandidates: [null, '', '   '],
      }),
    ).toBe('vendor@acme.com');
  });
});

describe('selectIssuerCandidates', () => {
  it('returns an empty list for missing or empty evidence', () => {
    expect(selectIssuerCandidates(undefined)).toEqual([]);
    expect(selectIssuerCandidates(null)).toEqual([]);
    expect(selectIssuerCandidates({})).toEqual([]);
  });

  it('orders the real (non-provider) body candidate ahead of forwarders and headers', () => {
    // The forwarded-Cloudflare case: live From is the forwarder; the real issuer
    // and the mailing-list provider both come from the quoted header block.
    const candidates = selectIssuerCandidates({
      from: 'Gil Gardosh <gil@the-guild.dev>',
      issuerCandidates: ['ap@the-guild.dev', 'noreply@notify.cloudflare.com'],
    });

    expect(candidates[0]).toBe('noreply@notify.cloudflare.com');
    // the known-provider forwarder is still included, but last
    expect(candidates).toContain('gil@the-guild.dev');
    expect(candidates).toContain('ap@the-guild.dev');
    expect(candidates.indexOf('ap@the-guild.dev')).toBeGreaterThan(
      candidates.indexOf('gil@the-guild.dev'),
    );
  });

  it('lower-cases and de-duplicates addresses', () => {
    expect(
      selectIssuerCandidates({
        from: 'VENDOR@ACME.COM',
        replyTo: 'vendor@acme.com',
        issuerCandidates: ['Vendor@Acme.com'],
      }),
    ).toEqual(['vendor@acme.com']);
  });

  it('extracts the bare address from a "Name <addr>" form', () => {
    expect(selectIssuerCandidates({ from: 'Acme Billing <billing@acme.com>' })).toEqual([
      'billing@acme.com',
    ]);
  });

  it('puts Reply-To ahead of a known-provider From', () => {
    const candidates = selectIssuerCandidates({
      from: 'notify@morning.co',
      replyTo: 'real@vendor.com',
    });
    expect(candidates[0]).toBe('real@vendor.com');
    expect(candidates).toContain('notify@morning.co');
  });
});
