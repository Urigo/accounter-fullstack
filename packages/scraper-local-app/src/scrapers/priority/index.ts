import type { Pool } from 'pg';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

export type PriorityScraperCredentials = {
  webUiUrl: string; // e.g. https://p.priority-connect.online/webui/AB4F6/
  odataUrl: string; // e.g. https://p.priority-connect.online/odata/Priority/tabab4f6.ini/a240825/
  username: string;
  password: string;
  ownerId: string;
  sourceConnectionId?: string | null;
  nickname?: string;
};

interface ODataInvoice {
  IVNUM: string;
  IVTYPE?: string;
  CUSTNAME?: string;
  CUST_VATID?: string;
  IVDATE?: string; // Edm.DateTimeOffset — invoice date
  DUEDATE?: string;
  DETAILS?: string;
  CURRENCY?: string;
  QPRICE?: number;
  VAT?: number;
  TOTPRICE?: number;
  DISCOUNT?: number;
  PAID?: number;
  BALANCE?: number;
  STATDES?: string;
  [key: string]: unknown;
}

/**
 * Launches a browser, completes the OIDC login flow on the Priority web UI,
 * and returns the OAuth access token by intercepting the token endpoint response.
 * This bypasses the PAT license restriction entirely.
 */
async function getOidcToken(
  webUiUrl: string,
  username: string,
  password: string,
): Promise<string> {
  puppeteerExtra.use(StealthPlugin());
  const browser = await puppeteerExtra.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();


    console.log('Priority: Navigating to web UI...');
    // Navigate to the web UI. This will trigger an OIDC redirect to /accounts/login.
    // We use domcontentloaded so we can attach listeners early; then we wait for
    // the OIDC redirect to complete before interacting with the login form.
    await page.goto(webUiUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Wait for OIDC redirect to the login page
    await page.waitForFunction(
      () => window.location.href.includes('/accounts/login'),
      { timeout: 30_000, polling: 500 },
    );
    console.log(`Priority: Login page: ${page.url().split('?')[0]}`);

    // Step 1: Click "כניסה באמצעות אימייל" to reveal the email/password form
    await page.waitForSelector('button', { timeout: 10_000 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        b => b.textContent?.includes('אימייל') || b.textContent?.toLowerCase().includes('email'),
      ) as HTMLButtonElement | undefined;
      if (btn) btn.click();
    });
    console.log('Priority: Clicked email login button');

    // Step 2: Fill email + password
    await page.waitForSelector('input[name="email"]', { timeout: 10_000 });
    await new Promise(r => setTimeout(r, 300));
    await page.click('input[name="email"]', { clickCount: 3 });
    await page.type('input[name="email"]', username);
    await page.click('input[name="password"]', { clickCount: 3 });
    await page.type('input[name="password"]', password);

    console.log('Priority: Submitting login form...');
    await page.click('button[type="submit"]');

    // After form submit, the OIDC flow redirects back to /webui/AB4F6/.
    // The token is stored in sessionStorage (not localStorage) under the key:
    // oidc.user:https://<host>/auth/:priority-web
    // Wait for the final URL (no code= param) and then read sessionStorage.
    await page.waitForFunction(
      () =>
        window.location.href.includes('/webui') &&
        !window.location.href.includes('code=') &&
        !window.location.href.includes('/accounts/'),
      { timeout: 30_000, polling: 300 },
    );

    const tokenData = await page.evaluate(() => {
      const key = Object.keys(sessionStorage).find(k => k.startsWith('oidc.user'));
      if (!key) return null;
      try {
        return JSON.parse(sessionStorage.getItem(key) ?? 'null') as {
          access_token?: string;
        } | null;
      } catch {
        return null;
      }
    });

    if (!tokenData?.access_token) {
      throw new Error(
        `Priority: OIDC token not found in sessionStorage after login. Page: ${page.url()}`,
      );
    }

    console.log('Priority: Access token obtained from sessionStorage');
    return tokenData.access_token;
  } finally {
    await browser.close().catch(() => null);
  }
}

async function fetchAllInvoices(odataUrl: string, token: string): Promise<ODataInvoice[]> {
  const base = odataUrl.replace(/\/$/, '');
  const all: ODataInvoice[] = [];

  // Fetch last 2 years
  const since = new Date();
  since.setFullYear(since.getFullYear() - 2);
  // IVDATE is Edm.DateTimeOffset — OData v4 literal syntax (no quotes, with Z suffix)
  const sinceStr = since.toISOString().replace(/\.\d{3}Z$/, 'Z');

  let url: string | null =
    `${base}/AINVOICES?$top=200&$filter=IVDATE ge ${sinceStr}&$orderby=IVDATE desc`;

  let page = 0;
  while (url && all.length < 10_000) {
    page++;
    console.log(`Priority: Fetching invoices page ${page}...`);
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Priority OData error ${res.status}: ${body.slice(0, 400)}`);
    }

    const data = (await res.json()) as {
      value: ODataInvoice[];
      '@odata.nextLink'?: string;
    };
    all.push(...data.value);
    url = data['@odata.nextLink'] ?? null;

    if (data.value.length === 0) break;
  }

  console.log(`Priority: Fetched ${all.length} invoices total`);
  return all;
}

async function saveInvoices(
  invoices: ODataInvoice[],
  pool: Pool,
  ownerId: string,
  sourceConnectionId: string | null,
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (const inv of invoices) {
    const result = await pool.query<{ is_new: boolean }>(
      `INSERT INTO accounter_schema.priority_invoices (
        owner_id, source_connection_id,
        ivnum, ivtype, custname, cust_vatid,
        curdate, duedate, details, currency,
        net_amount, vat, total, discount, paid, balance,
        statdes, synced_at, raw_json
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),$18)
      ON CONFLICT (owner_id, ivnum) DO UPDATE SET
        ivtype = EXCLUDED.ivtype,
        custname = EXCLUDED.custname,
        cust_vatid = EXCLUDED.cust_vatid,
        curdate = EXCLUDED.curdate,
        duedate = EXCLUDED.duedate,
        details = EXCLUDED.details,
        currency = EXCLUDED.currency,
        net_amount = EXCLUDED.net_amount,
        vat = EXCLUDED.vat,
        total = EXCLUDED.total,
        discount = EXCLUDED.discount,
        paid = EXCLUDED.paid,
        balance = EXCLUDED.balance,
        statdes = EXCLUDED.statdes,
        synced_at = NOW(),
        raw_json = EXCLUDED.raw_json,
        updated_at = NOW()
      RETURNING (xmax = 0) AS is_new`,
      [
        ownerId,
        sourceConnectionId ?? null,
        inv.IVNUM,
        inv.IVTYPE ?? null,
        inv.CUSTNAME ?? null,
        inv.CUST_VATID ?? null,
        inv.IVDATE ? new Date(inv.IVDATE) : null,
        inv.DUEDATE ? new Date(inv.DUEDATE) : null,
        inv.DETAILS ?? null,
        inv.CURRENCY ?? null,
        inv.QPRICE ?? null,
        inv.VAT ?? null,
        inv.TOTPRICE ?? null,
        inv.DISCOUNT ?? null,
        inv.PAID ?? null,
        inv.BALANCE ?? null,
        inv.STATDES ?? null,
        JSON.stringify(inv),
      ],
    );

    if (result.rows[0]?.is_new) inserted++;
    else updated++;
  }

  return { inserted, updated };
}

export async function scrapePriority(
  credentials: PriorityScraperCredentials,
  pool: Pool,
): Promise<void> {
  const label = credentials.nickname ?? credentials.username;
  console.log(`Priority [${label}]: Starting scrape via OIDC browser login...`);

  const token = await getOidcToken(
    credentials.webUiUrl,
    credentials.username,
    credentials.password,
  );

  const invoices = await fetchAllInvoices(credentials.odataUrl, token);

  const { inserted, updated } = await saveInvoices(
    invoices,
    pool,
    credentials.ownerId,
    credentials.sourceConnectionId ?? null,
  );

  console.log(`Priority [${label}]: Done. ${inserted} new, ${updated} updated.`);
}
