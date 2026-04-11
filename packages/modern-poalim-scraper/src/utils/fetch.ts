import type { Page } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';

export async function fetchPostWithinPage<TResult>(
  page: Page,
  url: string,
  data: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): Promise<TResult | null> {
  return page.evaluate(
    async (url, data, extraHeaders) => {
      const res = await fetch(url, {
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
      });

      if (res.status === 204) {
        return null;
      }

      if (res.headers.get('Content-Type')?.includes('application/json')) {
        return res.json() as Promise<TResult>;
      }

      const text = await res.text();
      throw new Error(`Unexpected response: ${text}`);
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
  return page.evaluate(async url => {
    const result = await fetch(url, { credentials: 'include' });

    if (result.status === 204) {
      return null;
    }

    if (result.headers.get('Content-Type')?.includes('application/json')) {
      return result.json() as Promise<TResult>;
    }

    const text = await result.text();
    throw new Error(`Unexpected response: ${text}`);
  }, url);
}

export async function fetchPoalimXSRFWithinPage<TResult>(
  page: Page,
  url: string,
  pageUuid: string,
): Promise<TResult | null> {
  const cookies = await page.cookies();
  const XSRFCookie = cookies.find(cookie => cookie.name === 'XSRF-TOKEN');
  const headers: Record<string, string> = {};
  if (XSRFCookie != null) {
    headers['X-XSRF-TOKEN'] = XSRFCookie.value;
  }
  headers['pageUuid'] = pageUuid;
  headers['uuid'] = uuidv4();
  headers['Content-Type'] = 'application/json;charset=UTF-8';
  return fetchPostWithinPage(page, url, {}, headers);
}
