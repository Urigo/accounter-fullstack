import { afterEach, describe, expect, it, vi } from 'vitest';
import { RENDER_TIMEOUT_MS, closeBrowser, renderHtmlToPdf } from '../html-to-pdf.js';

/**
 * A Chromium stand-in that models only the behaviour this module depends on,
 * calibrated against a real headless Chromium:
 *
 * - a subresource whose host accepts the connection and never answers (a
 *   rate-limiting tracking pixel — routine in marketing bodies) stays in flight
 *   forever;
 * - neither `load` nor `networkidle` settles while anything is in flight, so a
 *   `setContent` waiting for either burns its whole timeout and throws;
 * - `domcontentloaded` settles regardless of what is in flight;
 * - a `route()` handler that aborts a request takes it out of flight;
 * - `data:` resources are never routed.
 */
const harness = vi.hoisted(() => {
  interface FakeRoute {
    request(): { url(): string };
    abort(): Promise<void>;
    continue(): Promise<void>;
  }
  type RouteHandler = (route: FakeRoute) => unknown;

  interface SetContentCall {
    html: string;
    options?: { waitUntil?: string; timeout?: number };
  }

  const state = {
    launches: 0,
    contextOptions: [] as { javaScriptEnabled?: boolean }[],
    defaultTimeouts: [] as number[],
    setContentCalls: [] as SetContentCall[],
    loadStateCalls: [] as { state?: string; timeout?: number }[],
    /** URLs a route handler aborted before they could leave the browser. */
    aborted: [] as string[],
    /** URLs no route handler stopped — in flight, and never answered. */
    inFlight: [] as string[],
    /** Whether `route()` was registered before the first `setContent`. */
    routedBeforeSetContent: false,
    closedPages: 0,
    closedContexts: 0,
    /** Test knob: make `waitForLoadState` reject as if `load` never fired. */
    failLoadState: false,
    /** Test knob: make `pdf()` reject. */
    failPdf: false,
    reset() {
      state.launches = 0;
      state.contextOptions = [];
      state.defaultTimeouts = [];
      state.setContentCalls = [];
      state.loadStateCalls = [];
      state.aborted = [];
      state.inFlight = [];
      state.routedBeforeSetContent = false;
      state.closedPages = 0;
      state.closedContexts = 0;
      state.failLoadState = false;
      state.failPdf = false;
    },
  };

  /** Every http(s) subresource a real Chromium would request for this document. */
  function subresourceUrls(html: string): string[] {
    const urls: string[] = [];
    for (const match of html.matchAll(/(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
      const url = match[1] ?? match[2] ?? '';
      if (/^https?:\/\//i.test(url)) {
        urls.push(url);
      }
    }
    return urls;
  }

  function timeoutError(call: string, timeout: number): Error {
    return Object.assign(new Error(`${call}: Timeout ${timeout}ms exceeded.`), {
      name: 'TimeoutError',
    });
  }

  function createPage() {
    const routes: RouteHandler[] = [];
    let defaultTimeout = 30_000;
    let rendered = '';

    async function dispatch(url: string): Promise<void> {
      for (const handler of routes) {
        const outcome: { value: 'aborted' | 'continued' | null } = { value: null };
        await handler({
          request: () => ({ url: () => url }),
          abort: async () => {
            outcome.value = 'aborted';
          },
          continue: async () => {
            outcome.value = 'continued';
          },
        });
        if (outcome.value === 'aborted') {
          state.aborted.push(url);
          return;
        }
        if (outcome.value === 'continued') {
          break;
        }
      }
      state.inFlight.push(url);
    }

    return {
      setDefaultTimeout(timeout: number) {
        defaultTimeout = timeout;
        state.defaultTimeouts.push(timeout);
      },
      async route(_pattern: string, handler: RouteHandler) {
        if (state.setContentCalls.length === 0) {
          state.routedBeforeSetContent = true;
        }
        routes.push(handler);
      },
      async setContent(html: string, options?: { waitUntil?: string; timeout?: number }) {
        state.setContentCalls.push({ html, options });
        rendered = html;
        for (const url of subresourceUrls(html)) {
          await dispatch(url);
        }
        const waitUntil = options?.waitUntil ?? 'load';
        if (waitUntil !== 'domcontentloaded' && state.inFlight.length > 0) {
          throw timeoutError('page.setContent', options?.timeout ?? defaultTimeout);
        }
      },
      async waitForLoadState(loadState?: string, options?: { timeout?: number }) {
        state.loadStateCalls.push({ state: loadState, timeout: options?.timeout });
        if (state.failLoadState || (loadState !== 'domcontentloaded' && state.inFlight.length > 0)) {
          throw timeoutError('page.waitForLoadState', options?.timeout ?? defaultTimeout);
        }
      },
      async pdf() {
        if (state.failPdf) {
          throw new Error('pdf failed');
        }
        return Buffer.from(`%PDF-1.4\n${rendered}`);
      },
      async close() {
        state.closedPages += 1;
      },
    };
  }

  const chromium = {
    async launch() {
      state.launches += 1;
      return {
        on() {},
        async newContext(options?: { javaScriptEnabled?: boolean }) {
          state.contextOptions.push(options ?? {});
          return {
            async newPage() {
              return createPage();
            },
            async close() {
              state.closedContexts += 1;
            },
          };
        },
        async close() {},
      };
    },
  };

  return { state, chromium };
});

vi.mock('playwright', () => ({ chromium: harness.chromium }));

const { state } = harness;

/** An invoice body carrying the assets that made the old render hang. */
const HANGING_ASSETS_BODY = `<html><head>
  <link rel="stylesheet" href="http://tracker.invalid.test/style.css">
  <style>.total { color: red; }</style>
</head><body>
  <h1>Invoice 12345</h1>
  <p class="total">Total: 100.00 ILS</p>
  <img src="http://tracker.invalid.test/pixel.gif" width="1" height="1">
  <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">
</body></html>`;

afterEach(async () => {
  await closeBrowser();
  state.reset();
});

describe('renderHtmlToPdf — hanging remote assets', () => {
  it('renders a body whose remote assets never answer instead of dropping the document', async () => {
    const doc = await renderHtmlToPdf(HANGING_ASSETS_BODY);

    expect(doc.filename).toBe('body.pdf');
    expect(doc.mimeType).toBe('application/pdf');
    expect(doc.size).toBeGreaterThan(0);
    expect(doc.content.subarray(0, 5).toString()).toBe('%PDF-');
    // Nothing was left waiting on the network — the render never blocked.
    expect(state.inFlight).toEqual([]);
  });

  it('aborts every remote subresource rather than fetching it from the gateway', async () => {
    await renderHtmlToPdf(HANGING_ASSETS_BODY);

    expect(state.aborted).toContain('http://tracker.invalid.test/pixel.gif');
    expect(state.inFlight).toEqual([]);
  });

  it('blocks subresources before the content that requests them is set', async () => {
    await renderHtmlToPdf(HANGING_ASSETS_BODY);

    expect(state.routedBeforeSetContent).toBe(true);
  });

  it('keeps `inline-css` off the network, so an unreachable stylesheet cannot fail the render', async () => {
    const doc = await renderHtmlToPdf(HANGING_ASSETS_BODY);

    // `inline-css` fetches `<link rel=stylesheet>` hrefs itself when
    // `applyLinkTags` is on, and throws when one fails — the link never reaches
    // Chromium, and the render must not depend on it.
    const html = state.setContentCalls[0]?.html ?? '';
    expect(html).not.toContain('tracker.invalid.test/style.css');
    // The styling the body did inline is still applied.
    expect(html).toContain('color: red');
    expect(doc.size).toBeGreaterThan(0);
  });
});

describe('renderHtmlToPdf — wait strategy and budget', () => {
  it('waits only for `domcontentloaded`, with an explicit timeout', async () => {
    await renderHtmlToPdf('<p>hello</p>');

    expect(state.setContentCalls).toHaveLength(1);
    // `networkidle` never settles while an asset hangs, and `load` waits on the
    // very same assets — either one costs the full timeout and the document.
    expect(state.setContentCalls[0]?.options).toEqual({
      waitUntil: 'domcontentloaded',
      timeout: RENDER_TIMEOUT_MS,
    });
  });

  it('caps every timeout-taking step at the render budget', async () => {
    await renderHtmlToPdf('<p>hello</p>');

    expect(state.defaultTimeouts).toEqual([RENDER_TIMEOUT_MS]);
    expect(state.loadStateCalls).toEqual([{ state: 'load', timeout: RENDER_TIMEOUT_MS }]);
  });

  it('keeps the budget well under the ingest budget', () => {
    expect(RENDER_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });

  it('still produces a PDF when the load state never settles', async () => {
    state.failLoadState = true;

    const doc = await renderHtmlToPdf('<p>hello</p>');

    expect(doc.filename).toBe('body.pdf');
    expect(doc.size).toBeGreaterThan(0);
  });
});

describe('renderHtmlToPdf — browser hygiene', () => {
  it('renders with JavaScript disabled', async () => {
    await renderHtmlToPdf('<p>hello</p>');

    expect(state.contextOptions).toEqual([{ javaScriptEnabled: false }]);
  });

  it('reuses one browser across renders', async () => {
    await renderHtmlToPdf('<p>one</p>');
    await renderHtmlToPdf('<p>two</p>');

    expect(state.launches).toBe(1);
  });

  it('closes the page and context even when the render fails', async () => {
    state.failPdf = true;

    await expect(renderHtmlToPdf('<p>hello</p>')).rejects.toThrow('pdf failed');
    expect(state.closedPages).toBe(1);
    expect(state.closedContexts).toBe(1);
  });
});
