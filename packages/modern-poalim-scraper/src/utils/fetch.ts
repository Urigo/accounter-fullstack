import type { Page } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';

export async function fetchPostWithinPage<TResult>(
  page: Page,
  url: string,
  data: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): Promise<TResult | null> {
  return page.evaluate(
    (url, data, extraHeaders) => {
      return new Promise<TResult | null>((resolve, reject) => {
        fetch(url, {
          method: 'POST',
          body: JSON.stringify(data),
          credentials: 'include',
          headers: new Headers(
            Object.assign(
              {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              },
              extraHeaders,
            ),
          ),
        })
          .then(result => {
            if (result.status === 204) {
              // No content response
              resolve(null);
            } else {
              resolve(result.json());
            }
          })
          .catch(e => {
            reject(e);
          });
      });
    },
    url,
    data,
    extraHeaders,
  );
}

export async function fetchGetWithinPage<TResult>(
  page: Page,
  url: string,
): Promise<TResult | null> {
  return page.evaluate(url => {
    return new Promise<TResult | null>((resolve, reject) => {
      fetch(url, { credentials: 'include' })
        .then(result => {
          if (result.status === 204) {
            resolve(null);
          } else {
            resolve(result.json());
          }
        })
        .catch(e => {
          reject(e);
        });
    });
  }, url);
}

/** Matches a hostname against a cookie's domain, honouring the leading-dot wildcard form. */
function cookieDomainMatches(hostname: string, cookieDomain: string): boolean {
  const domain = cookieDomain.startsWith('.') ? cookieDomain.slice(1) : cookieDomain;
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * Reads the XSRF token for the page's own host.
 *
 * Cookies are read from the browser context rather than the page (the
 * page-level cookie API is deprecated), but every scraper shares the default
 * context — so the result must be filtered by domain, otherwise another bank's
 * `XSRF-TOKEN` could be picked up.
 */
export async function getXsrfToken(page: Page): Promise<string | undefined> {
  const { hostname } = new URL(page.url());
  const cookies = await page.browserContext().cookies();
  return cookies.find(
    cookie => cookie.name === 'XSRF-TOKEN' && cookieDomainMatches(hostname, cookie.domain),
  )?.value;
}

/** Session headers the mytrade SPA attaches to its own API calls. */
export type MytradeSession = {
  /** Server-issued session key. Generating one yields `InvalidSessionException`. */
  session: string;
  csession?: string | undefined;
};

/**
 * Captures the `session` / `csession` headers the mytrade SPA sends on its own
 * API calls, by listening to the page's outgoing requests.
 *
 * The session key is minted server-side when the SPA boots — the API rejects
 * anything we invent with `InvalidSessionException`, echoing the bad key back.
 * Rather than guessing where the SPA stashes it, let it authenticate and reuse
 * the headers off the wire.
 *
 * Attach this *before* navigating, then await it after `goto` resolves.
 */
export function captureMytradeSession(page: Page, timeoutMs = 30_000): Promise<MytradeSession> {
  return new Promise<MytradeSession>((resolve, reject) => {
    const timer = setTimeout(() => {
      page.off('request', onRequest);
      reject(
        new Error(
          'Timed out waiting for the mytrade SPA to issue an API request; no session header captured.',
        ),
      );
    }, timeoutMs);

    function onRequest(request: { url(): string; headers(): Record<string, string> }) {
      if (!request.url().includes('/mytrade/api/')) return;
      const headers = request.headers();
      const session = headers['session'];
      if (!session) return;
      clearTimeout(timer);
      page.off('request', onRequest);
      resolve({ session, csession: headers['csession'] });
    }

    page.on('request', onRequest);
  });
}

/**
 * The "mytrade" portfolio API sits behind a different gateway than the rest of
 * the Poalim REST surface: it wants the XSRF token like everything else, plus
 * the SPA's server-issued `session` key, and is called with an empty body
 * rather than `{}`.
 *
 * The method is per-endpoint: `account/view` is a POST, while the order
 * executions history is a GET (sending it as POST returns nothing).
 */
export async function fetchPoalimMytradeWithinPage<TResult>(
  page: Page,
  url: string,
  mytradeSession: MytradeSession,
  method: 'GET' | 'POST' = 'POST',
): Promise<TResult | null> {
  const xsrfToken = await getXsrfToken(page);
  const headers: Record<string, string> = {};
  if (xsrfToken != null) {
    headers['X-XSRF-TOKEN'] = xsrfToken;
  }
  headers['session'] = mytradeSession.session;
  if (mytradeSession.csession != null) {
    headers['csession'] = mytradeSession.csession;
  }
  headers['Content-Type'] = 'application/json; charset=utf-8';

  return page.evaluate(
    (url, headers, method) => {
      return new Promise<TResult | null>((resolve, reject) => {
        fetch(url, {
          method,
          credentials: 'include',
          headers: new Headers(headers),
        })
          .then(result => {
            if (result.status === 204) {
              resolve(null);
            } else {
              resolve(result.json());
            }
          })
          .catch(e => {
            reject(e);
          });
      });
    },
    url,
    headers,
    method,
  );
}

export async function fetchPoalimXSRFWithinPage<TResult>(
  page: Page,
  url: string,
  pageUuid: string,
): Promise<TResult | null> {
  const xsrfToken = await getXsrfToken(page);
  const headers: Record<string, string> = {};
  if (xsrfToken != null) {
    headers['X-XSRF-TOKEN'] = xsrfToken;
  }
  headers['pageUuid'] = pageUuid;
  headers['uuid'] = uuidv4();
  headers['Content-Type'] = 'application/json;charset=UTF-8';
  return fetchPostWithinPage(page, url, {}, headers);
}
