import type { Page } from 'puppeteer';
import { captureSessionId, LEUMI_BASE_URL, LEUMI_HOME_URL } from './broker.js';

const LOGIN_URL = `${LEUMI_BASE_URL}/authenticate/logon`;
const USERNAME_SELECTOR = 'input[placeholder="שם משתמש"]';
const PASSWORD_SELECTOR = 'input[placeholder="סיסמה"]';
const SUBMIT_SELECTOR = 'button[type="submit"]';
const CHANGE_PASSWORD_SELECTOR = 'form input[name="newPwd"]';
const INVALID_CREDENTIALS_TEXT = 'אחד או יותר מפרטי ההזדהות שמסרת שגויים';
const BLOCKED_TEXT = 'המנוי חסום';

/** The site this scraper reads: the single-page app at `/eBanking/SO/SPA.aspx`. */
const LEGACY_SITE = /\/eBanking\/SO\/SPA\.aspx/i;
/**
 * Leumi is moving accounts (business ones first) to a separate site with a different API.
 * This scraper does not read it; landing there is reported instead of timing out.
 */
const DIGITALFRONT_SITE = /\/staticcontent\/digitalfront\//i;

export type LeumiCredentials = {
  username: string;
  password: string;
};

export class LeumiLoginError extends Error {
  constructor(
    readonly reason:
      | 'INVALID_CREDENTIALS'
      | 'ACCOUNT_BLOCKED'
      | 'CHANGE_PASSWORD_REQUIRED'
      | 'UNSUPPORTED_SITE'
      | 'TIMEOUT',
    message: string,
  ) {
    super(message);
    this.name = 'LeumiLoginError';
  }
}

type LoginOutcome = 'signed-in' | 'digitalfront' | 'invalid' | 'blocked' | 'change-password';

/**
 * Signs in and returns the session ID the site's API calls need.
 *
 * Without `credentials` the sign-in page is opened and left for a person to fill in
 * (`manualLoginTimeoutMs`); the scraper carries on once the account home page loads.
 */
export async function login(
  page: Page,
  credentials: LeumiCredentials | undefined,
  { manualLoginTimeoutMs = 5 * 60_000 }: { manualLoginTimeoutMs?: number } = {},
): Promise<string> {
  return captureSessionId(
    page,
    async () => {
      await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(USERNAME_SELECTOR, { visible: true, timeout: 60_000 });
      await page.waitForSelector(PASSWORD_SELECTOR, { visible: true, timeout: 60_000 });

      if (credentials) {
        // The form is a React app: it only registers real key events, so the fields are
        // typed into rather than assigned.
        await page.click(USERNAME_SELECTOR);
        await page.type(USERNAME_SELECTOR, credentials.username, { delay: 40 });
        await page.click(PASSWORD_SELECTOR);
        await page.type(PASSWORD_SELECTOR, credentials.password, { delay: 40 });
        await page.click(SUBMIT_SELECTOR);
      }

      const outcome = await waitForOutcome(page, credentials ? 90_000 : manualLoginTimeoutMs);
      switch (outcome) {
        case 'signed-in':
          return;
        case 'invalid':
          throw new LeumiLoginError(
            'INVALID_CREDENTIALS',
            'Leumi rejected the username or password',
          );
        case 'blocked':
          throw new LeumiLoginError('ACCOUNT_BLOCKED', 'Leumi reports this user as blocked');
        case 'change-password':
          throw new LeumiLoginError(
            'CHANGE_PASSWORD_REQUIRED',
            'Leumi requires a new password; set one on the site and try again',
          );
        case 'digitalfront':
          throw new LeumiLoginError(
            'UNSUPPORTED_SITE',
            'This account opens in Leumi\'s new "digitalfront" site, which this scraper does not read yet',
          );
      }
    },
    (credentials ? 90_000 : manualLoginTimeoutMs) + 120_000,
  );
}

/**
 * For a page that is already signed in (a session someone opened by hand): reloads the
 * account home page and reads the session ID off its first API call.
 */
export async function attachToSignedInPage(page: Page): Promise<string> {
  return captureSessionId(page, async () => {
    await page.goto(LEUMI_HOME_URL, { waitUntil: 'domcontentloaded' });
    // A hash-only navigation does not reload; force one so the app boots and calls the API.
    await page.reload({ waitUntil: 'domcontentloaded' });
    if (!LEGACY_SITE.test(page.url())) {
      throw new LeumiLoginError('TIMEOUT', `Not signed in to Leumi (landed on ${page.url()})`);
    }
  });
}

async function waitForOutcome(page: Page, timeoutMs: number): Promise<LoginOutcome> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const url = page.url();
    if (LEGACY_SITE.test(url)) return 'signed-in';
    if (DIGITALFRONT_SITE.test(url)) return 'digitalfront';

    const seen = await page
      .evaluate(
        (changePasswordSelector, invalidText, blockedText) => {
          if (document.querySelector(changePasswordSelector)) return 'change-password';
          const text = document.body?.innerText ?? '';
          if (text.includes(invalidText)) return 'invalid';
          if (text.includes(blockedText)) return 'blocked';
          return null;
        },
        CHANGE_PASSWORD_SELECTOR,
        INVALID_CREDENTIALS_TEXT,
        BLOCKED_TEXT,
      )
      // The page navigates mid-check while signing in; look again on the next round.
      .catch(() => null);
    if (seen) return seen;

    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new LeumiLoginError('TIMEOUT', 'Timed out waiting for the Leumi sign-in to finish');
}
