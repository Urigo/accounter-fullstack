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
                'Content-Type':
                  'application/x-www-form-urlencoded; charset=UTF-8',
              },
              extraHeaders,
            ),
          ),
        })
          .then((result) => {
            if (result.status === 204) {
              // No content response
              resolve(null);
            } else {
              resolve(result.json());
            }
          })
          .catch((e) => {
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
  return page.evaluate((url) => {
    return new Promise<TResult | null>((resolve, reject) => {
      fetch(url, { credentials: 'include' })
        .then((result) => {
          if (result.status === 204) {
            resolve(null);
          } else {
            resolve(result.json());
          }
        })
        .catch((e) => {
          reject(e);
        });
    });
  }, url);
}

export async function fetchPoalimXSRFWithinPage<TResult>(
  page: Page,
  url: string,
  pageUuid: string,
): Promise<TResult | null> {
  const cookies = await page.cookies();
  const XSRFCookie = cookies.find((cookie) => cookie.name === 'XSRF-TOKEN');
  const headers: Record<string, string> = {};
  if (XSRFCookie != null) {
    headers['X-XSRF-TOKEN'] = XSRFCookie.value;
  }
  headers['pageUuid'] = pageUuid;
  headers['uuid'] = uuidv4();
  headers['Content-Type'] = 'application/json;charset=UTF-8';
  return fetchPostWithinPage(page, url, {}, headers);
}
