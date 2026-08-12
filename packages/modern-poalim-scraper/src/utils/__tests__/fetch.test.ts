import { describe, expect, it, vi } from 'vitest';
import type { Page } from 'puppeteer';
import { captureMytradeSession, getXsrfToken } from '../fetch.js';

// All scrapers share the default browser context, so the context returns cookies
// for every bank visited in the run — the lookup must be domain-scoped.
const cookies = [
  { name: 'XSRF-TOKEN', value: 'isracard-token', domain: 'digital.isracard.co.il' },
  { name: 'XSRF-TOKEN', value: 'poalim-token', domain: '.bankhapoalim.co.il' },
  { name: 'OTHER', value: 'irrelevant', domain: 'biz2.bankhapoalim.co.il' },
];

function pageAt(url: string): Page {
  return {
    url: () => url,
    browserContext: () => ({ cookies: () => Promise.resolve(cookies) }),
  } as unknown as Page;
}

describe('getXsrfToken', () => {
  it('picks the token for the page host, not another bank in the same context', async () => {
    await expect(getXsrfToken(pageAt('https://biz2.bankhapoalim.co.il/mytrade/app'))).resolves.toBe(
      'poalim-token',
    );
  });

  it('matches a wildcard (leading-dot) cookie domain against a subdomain', async () => {
    await expect(getXsrfToken(pageAt('https://login.bankhapoalim.co.il/x'))).resolves.toBe(
      'poalim-token',
    );
  });

  it('matches an exact-host cookie domain', async () => {
    await expect(
      getXsrfToken(pageAt('https://digital.isracard.co.il/y')),
    ).resolves.toBe('isracard-token');
  });

  it('does not match a host that merely shares a suffix string', async () => {
    await expect(
      getXsrfToken(pageAt('https://notbankhapoalim.co.il/z')),
    ).resolves.toBeUndefined();
  });

  it('returns undefined when no XSRF cookie exists for the host', async () => {
    await expect(getXsrfToken(pageAt('https://example.com/'))).resolves.toBeUndefined();
  });

  it('reads cookies from the browser context, not the deprecated page API', async () => {
    const contextCookies = vi.fn().mockResolvedValue(cookies);
    const pageCookies = vi.fn();
    const page = {
      url: () => 'https://biz2.bankhapoalim.co.il/',
      cookies: pageCookies,
      browserContext: () => ({ cookies: contextCookies }),
    } as unknown as Page;

    await getXsrfToken(page);
    expect(contextCookies).toHaveBeenCalledOnce();
    expect(pageCookies).not.toHaveBeenCalled();
  });
});

/** Minimal stand-in for puppeteer's request-event plumbing. */
function emitterPage() {
  const listeners = new Set<(req: unknown) => void>();
  const page = {
    on: (event: string, fn: (req: unknown) => void) => {
      if (event === 'request') listeners.add(fn);
      return page;
    },
    off: (event: string, fn: (req: unknown) => void) => {
      if (event === 'request') listeners.delete(fn);
      return page;
    },
  } as unknown as Page;

  const emit = (url: string, headers: Record<string, string>) => {
    for (const fn of [...listeners]) fn({ url: () => url, headers: () => headers });
  };

  return { page, emit, listenerCount: () => listeners.size };
}

describe('captureMytradeSession', () => {
  it("captures the SPA's server-issued session and csession headers", async () => {
    const { page, emit } = emitterPage();
    const captured = captureMytradeSession(page);

    emit('https://biz2.bankhapoalim.co.il/mytrade/api/v2/json2/account/view', {
      session: 'server-issued-key',
      csession: '0.602',
    });

    await expect(captured).resolves.toEqual({
      session: 'server-issued-key',
      csession: '0.602',
    });
  });

  it('ignores requests to other endpoints', async () => {
    const { page, emit } = emitterPage();
    const captured = captureMytradeSession(page, 50);

    emit('https://biz2.bankhapoalim.co.il/ServerServices/general/accounts', {
      session: 'not-from-mytrade',
    });

    await expect(captured).rejects.toThrow(/Timed out/);
  });

  it('ignores mytrade requests that carry no session header', async () => {
    const { page, emit } = emitterPage();
    const captured = captureMytradeSession(page, 50);

    emit('https://biz2.bankhapoalim.co.il/mytrade/api/v2/json2/whatever', { accept: '*/*' });

    await expect(captured).rejects.toThrow(/Timed out/);
  });

  it('resolves without csession when the SPA omits it', async () => {
    const { page, emit } = emitterPage();
    const captured = captureMytradeSession(page);

    emit('https://biz2.bankhapoalim.co.il/mytrade/api/x', { session: 'key-only' });

    await expect(captured).resolves.toEqual({ session: 'key-only', csession: undefined });
  });

  it('detaches its listener once resolved, and after timing out', async () => {
    const { page, emit, listenerCount } = emitterPage();
    const captured = captureMytradeSession(page);
    expect(listenerCount()).toBe(1);
    emit('https://biz2.bankhapoalim.co.il/mytrade/api/x', { session: 'k' });
    await captured;
    expect(listenerCount()).toBe(0);

    const timedOut = captureMytradeSession(page, 20);
    expect(listenerCount()).toBe(1);
    await expect(timedOut).rejects.toThrow(/Timed out/);
    expect(listenerCount()).toBe(0);
  });
});
