import { createHash } from 'node:crypto';
import inlineCss from 'inline-css';
import { chromium, type Browser, type Page } from 'playwright';
import type { ExtractedDocument } from './mime-extractor.js';

/**
 * Budget for a single body→PDF render, applied to every Playwright step below.
 *
 * Email bodies are static documents and their remote subresources are blocked
 * (see {@link renderHtmlToPdf}), so there is nothing to settle: a render that is
 * not finished in a few seconds is hung, not slow. The cap sits well under the
 * ingest budget — the Cloudflare Worker holds an open HTTP request for the whole
 * orchestration — so one pathological body cannot dominate an email.
 */
export const RENDER_TIMEOUT_MS = 5000;

// A single shared browser instance is reused across renders to bound memory and
// avoid the cost of launching Chromium per request. It is created lazily on the
// first render and kept warm for the lifetime of the gateway process.
//
// NOTE: the gateway runtime must have a Chromium binary available (e.g.
// `playwright install --with-deps chromium` in the image). Render failures are
// caught by callers (treatment), which simply omit the body→PDF document.
let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  browserPromise ??= chromium
    .launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    .then(browser => {
      // If the shared browser crashes or is closed, drop the cached promise so
      // the next render relaunches a fresh instance instead of reusing a dead one.
      browser.on('disconnected', () => {
        browserPromise = null;
      });
      return browser;
    })
    .catch((err: unknown) => {
      // Reset so a later render can retry the launch.
      browserPromise = null;
      throw err;
    });
  return browserPromise;
}

/**
 * Render an email's HTML body to a PDF document (ported from the legacy
 * gmail-listener `convertHtmlToPdf`, including the `inline-css` step). Returns an
 * {@link ExtractedDocument} with the rendered bytes + content hash.
 */
export async function renderHtmlToPdf(rawHtml: string): Promise<ExtractedDocument> {
  const browser = await getBrowser();
  // Email HTML is untrusted and must render statically — disable JavaScript so a
  // malicious body cannot run scripts in the headless browser (XSS, SSRF, or
  // local-resource probing). Email clients block JS anyway, so this matches how
  // the body would render in a real client.
  const context = await browser.newContext({ javaScriptEnabled: false });
  // `page` is created inside the try so that a newPage() failure still runs the
  // finally and closes the context (otherwise the context would leak).
  let page: Page | undefined;
  try {
    page = await context.newPage();
    // Bound every Playwright call that takes a timeout, not just the explicit
    // ones below, so no step can outlive the render budget.
    page.setDefaultTimeout(RENDER_TIMEOUT_MS);
    // Nothing leaves this browser. The remote subresources of an untrusted email
    // body are a liability rather than content:
    //   - tracking pixels, beacons and images on hosts that hang or rate-limit
    //     are routine in marketing bodies, and each one is a request the render
    //     would otherwise wait on;
    //   - every such fetch goes out from the gateway's IP with none of
    //     `link-fetcher.ts`'s SSRF guards applying to a Chromium-issued request,
    //     and confirms delivery to the sender's tracking endpoint.
    // Inline (`data:`) images are unaffected — Playwright does not route them.
    await page.route('**/*', route => route.abort());
    // `applyLinkTags` (on by default) makes `inline-css` itself fetch every
    // `<link rel=stylesheet>` href over the network, unbounded, and *throw* when
    // one fails — an unreachable stylesheet host in the body would drop the
    // document before Chromium is even involved. `removeLinkTags` already
    // strips the tags, so the rendered output only loses styling the body
    // declined to inline.
    const html = await inlineCss(rawHtml, { url: '/', applyLinkTags: false });
    // `domcontentloaded` is the only wait guaranteed to settle for a static
    // document. `networkidle` (500 ms with zero connections) never settles for a
    // body whose assets hang, and `load` waits on those same assets — both burn
    // the whole timeout and lose the document. `load` is then awaited
    // best-effort, so inline images get a chance to decode without a body that
    // never reaches it being dropped.
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: RENDER_TIMEOUT_MS });
    await page.waitForLoadState('load', { timeout: RENDER_TIMEOUT_MS }).catch(() => {});
    const pdf = Buffer.from(await page.pdf());
    return {
      filename: 'body.pdf',
      mimeType: 'application/pdf',
      content: pdf,
      size: pdf.length,
      sha256: createHash('sha256').update(pdf).digest('hex'),
    };
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    await context.close().catch(() => {});
  }
}

/** Close the shared browser (graceful shutdown / tests). */
export async function closeBrowser(): Promise<void> {
  const pending = browserPromise;
  browserPromise = null;
  if (pending) {
    await pending.then(b => b.close()).catch(() => {});
  }
}
