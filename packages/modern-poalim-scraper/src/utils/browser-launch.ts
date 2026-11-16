/**
 * Which browser the scrapers launch.
 *
 * By default they run on the installed Google Chrome (`channel: 'chrome'`), not on a browser build
 * downloaded by puppeteer or Playwright. Each library pins one exact build per version, and nothing
 * in this repo downloads it (the root `package.json` sets `puppeteer.skipDownload`, and Playwright
 * never downloads on install), so every dependency bump used to break scraping until someone
 * installed the new build by hand.
 *
 * This library reads no env variables; callers pass an override in.
 */
export interface BrowserOptions {
  /** Path to a Chrome/Chromium executable. When set, it is used instead of the installed Chrome. */
  executablePath?: string;
}

/**
 * Launch options selecting the browser, shared by the puppeteer and Playwright launch sites.
 * Returns exactly one of `executablePath` or `channel`: puppeteer ignores `channel` when
 * `executablePath` is set, and only falls back to `PUPPETEER_EXECUTABLE_PATH` when neither is
 * passed, so passing one keeps the choice explicit.
 */
export function browserTarget(
  browser?: BrowserOptions,
): { executablePath: string } | { channel: 'chrome' } {
  if (browser?.executablePath) {
    return { executablePath: browser.executablePath };
  }
  return { channel: 'chrome' };
}
