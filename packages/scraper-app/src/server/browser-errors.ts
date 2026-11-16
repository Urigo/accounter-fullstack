/**
 * The scrapers launch the installed Google Chrome rather than a browser downloaded by puppeteer or
 * Playwright. When Chrome is missing, the libraries throw messages that don't say what to do, so the
 * scrape runner swaps them for this one.
 */
export const CHROME_MISSING_MESSAGE =
  'Google Chrome is not installed. Install it from https://www.google.com/chrome/ and run the scrape again.';

/** Messages puppeteer and Playwright throw when the browser to launch is not on the machine. */
const MISSING_BROWSER_PATTERNS: RegExp[] = [
  // puppeteer, `channel: 'chrome'` with no Chrome installed
  /Could not find Google Chrome executable for channel/,
  // puppeteer, no channel/executablePath and no downloaded build
  /Could not find Chrome \(ver\./,
  // puppeteer, `executablePath` pointing at nothing
  /Browser was not found at the configured executablePath/,
  /Tried to find the browser at the configured path/,
  // Playwright, `channel: 'chrome'` with no Chrome installed
  /Chromium distribution 'chrome' is not found/,
  // Playwright, `executablePath` pointing at nothing (or a missing downloaded build)
  /Failed to launch \w+ because executable doesn't exist/,
  /Executable doesn't exist at/,
];

const MAX_CAUSE_DEPTH = 10;

/**
 * Whether `error`, or any error in its `cause` chain, is a missing-browser launch failure. The
 * chain matters because scrapers wrap launch errors (e.g. `newHomePage - …`, `{ cause }`).
 */
export function isMissingBrowserError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current != null; depth++) {
    const message = current instanceof Error ? current.message : String(current);
    if (MISSING_BROWSER_PATTERNS.some(pattern => pattern.test(message))) {
      return true;
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}
