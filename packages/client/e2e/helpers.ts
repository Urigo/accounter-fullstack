import { createServer, request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, type Page, type Request } from '@playwright/test';
import { PAGE_SIZE, type ChargeGroup } from './data.js';
import { SERVER_URL } from './env.js';

export type ChargesFilter = Record<string, unknown>;

/** A filter selecting exactly `group`, oldest first, as the dialog would write it to the URL. */
export function groupFilter(group: ChargeGroup): ChargesFilter {
  return {
    freeText: group.search,
    fromAnyDate: '2025-01-01',
    sortBy: { asc: true, field: 'DATE' },
    toAnyDate: '2025-12-31',
  };
}

/** The All Charges URL for a filter and zero-based page, encoded the way the app encodes it. */
export function chargesUrl(filter?: ChargesFilter, page = 0): string {
  const params = new URLSearchParams();
  if (page) {
    params.set('page', String(page));
  }
  if (filter) {
    params.set('chargesFilters', encodeURIComponent(JSON.stringify(filter)));
  }
  const search = params.toString();
  return `/charges${search ? `?${search}` : ''}`;
}

/** The descriptions of `group` that page `page` (zero-based) shows, oldest first. */
export function pageOf(group: ChargeGroup, page: number): string[] {
  return group.descriptions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
}

export type AllChargesCall = {
  page: number;
  filters: ChargesFilter;
};

type GraphQLOperation = { operationName?: string; variables?: Record<string, unknown> };

/** The GraphQL operation a request carries, whether urql sent it as a GET or a POST. */
export function graphqlOperation(request: Request): GraphQLOperation | null {
  const url = new URL(request.url());
  if (!url.pathname.endsWith('/graphql')) {
    return null;
  }
  if (request.method() === 'GET') {
    const variables = url.searchParams.get('variables');
    return {
      operationName: url.searchParams.get('operationName') ?? undefined,
      variables: variables ? JSON.parse(variables) : undefined,
    };
  }
  if (request.method() === 'POST') {
    try {
      return request.postDataJSON() as GraphQLOperation;
    } catch {
      return null;
    }
  }
  return null;
}

export function isAllCharges(request: Request): boolean {
  return graphqlOperation(request)?.operationName === 'AllCharges';
}

/** GraphQL traffic on a page: how many requests are open, and when that last changed. */
type GraphQLActivity = { inFlight: number; lastChange: number };

const activityByPage = new WeakMap<Page, GraphQLActivity>();

/**
 * Records every AllCharges request the page sends from now on. Read the array at any point; it
 * keeps growing. Also starts the GraphQL activity count `settle` waits on, so call it before the
 * first navigation.
 */
export function trackAllCharges(page: Page): AllChargesCall[] {
  const calls: AllChargesCall[] = [];
  const activity: GraphQLActivity = { inFlight: 0, lastChange: Date.now() };
  activityByPage.set(page, activity);
  const isGraphQL = (request: Request) => new URL(request.url()).pathname.endsWith('/graphql');
  const ended = (request: Request) => {
    if (isGraphQL(request)) {
      activity.inFlight -= 1;
      activity.lastChange = Date.now();
    }
  };

  page.on('request', request => {
    if (!isGraphQL(request)) {
      return;
    }
    activity.inFlight += 1;
    activity.lastChange = Date.now();
    const operation = graphqlOperation(request);
    if (operation?.operationName === 'AllCharges') {
      calls.push({
        page: Number(operation.variables?.page ?? 0),
        filters: (operation.variables?.filters ?? {}) as ChargesFilter,
      });
    }
  });
  page.on('requestfinished', ended);
  page.on('requestfailed', ended);
  return calls;
}

const CHARGE_DESCRIPTION = /^(Acme|Globex|Mergeable) charge/;

/** The seeded charge descriptions the table shows, top to bottom. */
export async function shownCharges(page: Page): Promise<string[]> {
  const texts = await page.locator('table td p').allTextContents();
  return texts.map(text => text.trim()).filter(text => CHARGE_DESCRIPTION.test(text));
}

/** Waits until the table shows exactly `expected`, in order. */
export async function expectCharges(page: Page, expected: string[]): Promise<void> {
  await expect.poll(() => shownCharges(page), { timeout: 15_000 }).toEqual(expected);
}

/** How long GraphQL traffic must stay quiet before `settle` returns. */
const QUIET_MS = 500;

/**
 * Waits until no GraphQL request is open and none has started or ended for `QUIET_MS`, so a test
 * can assert that a request was *not* sent: anything the page was going to send has been sent by
 * then. Needs `trackAllCharges` on the page.
 *
 * Not `waitForLoadState('networkidle')`: that state is per document and is reached once, so after a
 * page's first quiet spell it returns at once, and paging, filtering and history moves here are all
 * same-document navigations.
 */
export async function settle(page: Page): Promise<void> {
  const activity = activityByPage.get(page);
  if (!activity) {
    throw new Error('settle() needs trackAllCharges(page) to have been called first.');
  }
  await expect
    .poll(() => activity.inFlight === 0 && Date.now() - activity.lastChange >= QUIET_MS, {
      intervals: [100],
      timeout: 15_000,
      message: 'GraphQL traffic did not go quiet',
    })
    .toBe(true);
}

/**
 * Resolves once the browser has stopped reading `request`'s response. urql cancels the read right
 * after a multipart response's last part (`hasNext: false`), before the closing delimiter, so the
 * browser reports a deferred query as failed (`net::ERR_ABORTED`) rather than finished; either way,
 * the client has handled every part by then.
 */
export function requestDone(page: Page, request: Request): Promise<unknown> {
  return Promise.race([
    page.waitForEvent('requestfinished', { predicate: r => r === request, timeout: 0 }),
    page.waitForEvent('requestfailed', { predicate: r => r === request, timeout: 0 }),
  ]);
}

declare global {
  interface Window {
    __e2eErrorToasts?: string[];
  }
}

/**
 * Page init script (`page.addInitScript`): records the text of every error toast (sonner,
 * `data-type="error"`) the page shows, in `window.__e2eErrorToasts`. Runs in the browser, so it
 * must not reference anything outside itself.
 */
export function recordErrorToasts(): void {
  const seen = new WeakSet<Element>();
  const found: string[] = [];
  window.__e2eErrorToasts = found;
  const scan = () => {
    for (const toast of document.querySelectorAll('[data-sonner-toast][data-type="error"]')) {
      if (!seen.has(toast)) {
        seen.add(toast);
        found.push(toast.textContent?.trim() ?? '');
      }
    }
  };
  new MutationObserver(scan).observe(document, { childList: true, subtree: true });
}

/** The error toasts recorded by `recordErrorToasts` since the page loaded. */
export async function errorToasts(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__e2eErrorToasts ?? []);
}

/** The current URL's page index and filter, as the app reads them. */
export function urlState(page: Page): { page: number; filter: ChargesFilter | null } {
  const params = new URL(page.url()).searchParams;
  const raw = params.get('chargesFilters');
  return {
    page: Number(params.get('page') ?? 0),
    filter: raw ? (JSON.parse(decodeURIComponent(raw)) as ChargesFilter) : null,
  };
}

export function paginationOf(page: Page) {
  return page.getByRole('navigation', { name: 'pagination' });
}

/**
 * A pass-through proxy to the GraphQL server that can hold a multipart (`@defer`) response open
 * after its first part.
 *
 * Playwright's `route.fulfill` sends a whole body at once, and urql treats a multipart stream that
 * ends early as complete, so neither can keep a deferred response pending. Routing the request here
 * instead (`route.continue({ url })`) keeps the browser's real network stack, and with it a stream
 * that is still open: the client has the first part and is waiting for the rest.
 */
export async function startHoldingProxy(): Promise<{
  url: string;
  /** Resolves once a held response has sent its first part. */
  firstPartSent: Promise<void>;
  /** Sends the rest of every held response. */
  release: () => void;
  close: () => Promise<void>;
}> {
  const held: Array<() => void> = [];
  let released = false;
  let onFirstPart!: () => void;
  const firstPartSent = new Promise<void>(resolve => {
    onFirstPart = resolve;
  });

  const server = createServer((req, res) => {
    const upstream = new URL(req.url ?? '/', SERVER_URL);
    const headers: IncomingHttpHeaders = { ...req.headers, host: upstream.host };
    const forward = httpRequest(upstream, { method: req.method, headers }, async upstreamRes => {
      const chunks: Buffer[] = [];
      for await (const chunk of upstreamRes) {
        chunks.push(chunk as Buffer);
      }
      const body = Buffer.concat(chunks).toString('utf8');
      const responseHeaders = { ...upstreamRes.headers };
      delete responseHeaders['content-length'];
      delete responseHeaders['transfer-encoding'];
      res.writeHead(upstreamRes.statusCode ?? 502, responseHeaders);

      const boundary = /boundary="?([^=";]+)"?/i.exec(
        upstreamRes.headers['content-type'] ?? '',
      )?.[1];
      const delimiter = boundary ? `\r\n--${boundary}` : null;
      // The delimiter that ends the first part: the first one after that part's headers (the
      // body may open with a delimiter of its own).
      const firstPartBody = body.indexOf('\r\n\r\n');
      const cut = delimiter && firstPartBody >= 0 ? body.indexOf(delimiter, firstPartBody) : -1;
      if (!delimiter || cut < 0 || released) {
        res.end(body);
        return;
      }
      // Up to and including the delimiter after the first part, which is what lets the client
      // parse that part; the rest waits for `release`.
      const end = cut + delimiter.length;
      res.write(body.slice(0, end));
      onFirstPart();
      held.push(() => res.end(body.slice(end)));
    });
    forward.on('error', error => {
      res.writeHead(502).end(String(error));
    });
    req.pipe(forward);
  });

  await new Promise<void>(resolve => server.listen(0, 'localhost', resolve));
  const { port } = server.address() as AddressInfo;

  const release = () => {
    released = true;
    for (const send of held.splice(0)) {
      send();
    }
  };

  return {
    url: `http://localhost:${port}`,
    firstPartSent,
    release,
    close: async () => {
      release();
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}
