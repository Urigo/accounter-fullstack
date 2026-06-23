import { createHash } from 'node:crypto';
import inlineCss from 'inline-css';
import { chromium, type Browser, type Page } from 'playwright';
import type { ExtractedDocument } from './mime-extractor.js';

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
  const context = await browser.newContext();
  // `page` is created inside the try so that a newPage() failure still runs the
  // finally and closes the context (otherwise the context would leak).
  let page: Page | undefined;
  try {
    page = await context.newPage();
    const html = await inlineCss(rawHtml, { url: '/' });
    await page.setContent(html, { waitUntil: 'networkidle' });
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
