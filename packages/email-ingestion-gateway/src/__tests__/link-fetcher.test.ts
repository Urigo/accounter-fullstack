import { describe, expect, it } from 'vitest';
import { getLinkFromBody, isBlockedHost } from '../link-fetcher.js';

describe('getLinkFromBody', () => {
  it('returns the first href matching the configured host + path prefix', () => {
    const body =
      '<a href="https://vendor.com/other">x</a> <a href="https://vendor.com/invoices/123">y</a>';
    expect(getLinkFromBody(body, 'https://vendor.com/invoices')).toBe(
      'https://vendor.com/invoices/123',
    );
  });

  it('matches an exact path', () => {
    const body = '<a href="https://vendor.com/download">d</a>';
    expect(getLinkFromBody(body, 'https://vendor.com/download')).toBe(
      'https://vendor.com/download',
    );
  });

  it('returns null when no href matches the host', () => {
    const body = '<a href="https://evil.com/invoices/1">x</a>';
    expect(getLinkFromBody(body, 'https://vendor.com/invoices')).toBeNull();
  });

  it('does not match a different path that merely shares a prefix string', () => {
    const body = '<a href="https://vendor.com/invoices-evil/1">x</a>';
    expect(getLinkFromBody(body, 'https://vendor.com/invoices')).toBeNull();
  });

  it('returns null for an invalid configured URL', () => {
    expect(getLinkFromBody('<a href="https://vendor.com/x">x</a>', 'not a url')).toBeNull();
  });

  it('returns null when the body has no links', () => {
    expect(getLinkFromBody('no links here', 'https://vendor.com/x')).toBeNull();
  });
});

describe('isBlockedHost (SSRF defense)', () => {
  it('blocks loopback hosts', () => {
    expect(isBlockedHost('localhost')).toBe(true);
    expect(isBlockedHost('127.0.0.1')).toBe(true);
    expect(isBlockedHost('::1')).toBe(true);
  });

  it('blocks private IPv4 ranges', () => {
    expect(isBlockedHost('10.0.0.5')).toBe(true);
    expect(isBlockedHost('192.168.1.1')).toBe(true);
    expect(isBlockedHost('172.16.0.1')).toBe(true);
    expect(isBlockedHost('172.31.255.255')).toBe(true);
    expect(isBlockedHost('169.254.1.1')).toBe(true);
  });

  it('blocks .local / .internal / .localhost suffixes', () => {
    expect(isBlockedHost('foo.internal')).toBe(true);
    expect(isBlockedHost('printer.local')).toBe(true);
    expect(isBlockedHost('api.localhost')).toBe(true);
  });

  it('allows public hosts and public IPs', () => {
    expect(isBlockedHost('vendor.com')).toBe(false);
    expect(isBlockedHost('8.8.8.8')).toBe(false);
    expect(isBlockedHost('172.32.0.1')).toBe(false); // outside the 172.16–31 private range
  });
});
