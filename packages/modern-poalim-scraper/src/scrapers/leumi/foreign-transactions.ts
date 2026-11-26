import { format } from 'date-fns';
import type { Page } from 'puppeteer';
import { z } from 'zod';
import { LEUMI_BASE_URL, validate } from './broker.js';

/**
 * Foreign-currency accounts are the one area still served as a server-rendered page
 * (ASP.NET WebForms) with no JSON behind it, so this module reads the page's table.
 * The cells are validated as text first; nothing is guessed from a cell that does not
 * look like what it should be.
 */
const FOREIGN_ACTIVITY_URL = `${LEUMI_BASE_URL}/eBanking/ForeignCurrency/DisplayForeignAccountsActivity.aspx`;

const ACCOUNTS_SELECTOR = '#ddlAccounts_m_ddl';
const PERIOD_SELECTOR = '#ddlTransactionPeriod';
const FROM_DATE_SELECTOR = '#dtFromDate_textBox';
const TO_DATE_SELECTOR = '#dtToDate_textBox';
const SUBMIT_SELECTOR = '#btnDisplayDates';
const ACTIVITY_TABLE_SELECTOR = '#ctlActivityTable';
const NO_DATA_SELECTOR = '#NOINFORMATIONREGIONSERVERSIDEERROR';
const VALIDATION_MESSAGE_SELECTOR = '.VAMErrorText, #fromDateminError, #toDateminError';
/** Value of "between dates" in the period drop-down. */
const PERIOD_BETWEEN_DATES = '3';
/** The page's own date format: `27/11/23`. */
const PAGE_DATE_FORMAT = 'dd/MM/yy';

const EXPECTED_HEADERS = ['תאריך', 'תיאור', 'אסמכתא', 'חובה', 'זכות', 'יתרה'];

/** Currency names as the page prints them, once quotes and extra spaces are removed. */
const CURRENCY_BY_LABEL: Record<string, string> = {
  'דולר ארהב': 'USD',
  אירו: 'EUR',
  'לירה שטרלינג': 'GBP',
  'פרנק שוויצרי': 'CHF',
  'יין יפני': 'JPY',
  'דולר קנדי': 'CAD',
  'דולר אוסטרלי': 'AUD',
  'כתר שוודי': 'SEK',
  'כתר נורווגי': 'NOK',
  'כתר דני': 'DKK',
};

/** `דולר ארה"ב` → `USD`. `null` for a label this table does not know: never guessed. */
export function mapLeumiCurrencyLabel(label: string): string | null {
  const normalized = label
    .replace(/["'`׳״]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return CURRENCY_BY_LABEL[normalized] ?? null;
}

const pageDate = z.string().regex(/^\d{2}\/\d{2}\/\d{2}$/, 'Expected dd/MM/yy');
const amount = z.string().regex(/^-?\d{1,3}(,\d{3})*\.\d{2}$/, 'Expected an amount like 1,234.56');
const amountOrEmpty = z.union([amount, z.literal('')]);

const foreignTransactionRowSchema = z
  .object({
    date: pageDate,
    description: z.string().min(1),
    reference: z.string().regex(/^\d*$/),
    debit: amountOrEmpty,
    credit: amountOrEmpty,
    balance: amount,
  })
  .strict()
  // A row moves money one way: exactly one of the two columns is filled.
  .refine(row => (row.debit === '') !== (row.credit === ''), {
    message: 'Expected exactly one of debit / credit',
  });

export const foreignAccountActivitySchema = z
  .object({
    /** The drop-down entry this activity belongs to. */
    account: z.object({ value: z.string().min(1), label: z.string().min(1) }).strict(),
    currencyLabel: z.string().min(1),
    /** ISO code for `currencyLabel`; `null` (and invalid) when the label is not known. */
    currency: z.string().regex(/^[A-Z]{3}$/),
    asOfDate: pageDate,
    /** Current balance of the account ("יתרת עו"ש"). */
    balance: amount,
    lastActionDate: z.union([pageDate, z.literal('')]),
    fromDate: pageDate,
    toDate: pageDate,
    headers: z.tuple([
      z.literal(EXPECTED_HEADERS[0]),
      z.literal(EXPECTED_HEADERS[1]),
      z.literal(EXPECTED_HEADERS[2]),
      z.literal(EXPECTED_HEADERS[3]),
      z.literal(EXPECTED_HEADERS[4]),
      z.literal(EXPECTED_HEADERS[5]),
    ]),
    /** Oldest first, as the page lists them. Amounts are the page's own text. */
    transactions: z.array(foreignTransactionRowSchema),
  })
  .strict();

export type ForeignAccountActivity = z.infer<typeof foreignAccountActivitySchema>;

export type ForeignAccountOption = { value: string; label: string };

/** Strips the bidi control characters the page wraps account numbers in. */
function cleanText(text: string): string {
  return text
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function openActivityPage(page: Page) {
  await page.goto(FOREIGN_ACTIVITY_URL, { waitUntil: 'networkidle2', timeout: 60_000 });
  if (!page.url().startsWith(FOREIGN_ACTIVITY_URL)) {
    throw new Error(`Leumi foreign-currency page did not open (landed on ${page.url()})`);
  }
}

/**
 * The foreign-currency accounts in the page's drop-down, one per currency.
 * Empty when the user has none (the page then has no drop-down).
 */
export async function getForeignAccounts(page: Page): Promise<ForeignAccountOption[]> {
  await openActivityPage(page);
  const options = await page.$$eval(`${ACCOUNTS_SELECTOR} option`, elements =>
    elements.map(element => ({
      value: (element as HTMLOptionElement).value,
      label: element.textContent ?? '',
    })),
  );
  return options
    .filter(option => option.value !== '')
    .map(option => ({ value: option.value, label: cleanText(option.label) }));
}

/**
 * Transactions of one foreign-currency account between two dates, with its balance.
 * `account` is an entry from `getForeignAccounts`.
 */
export async function getForeignTransactions(
  page: Page,
  account: ForeignAccountOption,
  range: { fromDate: Date; toDate: Date },
  validateSchema: boolean,
) {
  await openActivityPage(page);
  await page.waitForSelector(ACCOUNTS_SELECTOR, { timeout: 30_000 });

  // Choosing an account posts the form back; wait for the page it returns.
  const selected = await page.$eval(ACCOUNTS_SELECTOR, el => (el as HTMLSelectElement).value);
  if (selected !== account.value) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60_000 }).catch(() => null),
      page.select(ACCOUNTS_SELECTOR, account.value),
    ]);
  }

  // The page serves foreign-currency activity from a cut-off date onwards (two years back;
  // shorter than the three years of the shekel account) and refuses, without posting, a
  // range that starts on or before it. The cut-off is the page's own variable, so the
  // range is clamped to it. The `fromDate` in the result is the date actually used.
  const earliest = await readEarliestAvailableDate(page);
  const fromDate = range.fromDate < earliest ? earliest : range.fromDate;

  await page.select(PERIOD_SELECTOR, PERIOD_BETWEEN_DATES);
  for (const [selector, date] of [
    [FROM_DATE_SELECTOR, fromDate],
    [TO_DATE_SELECTOR, range.toDate],
  ] as const) {
    await page.waitForSelector(selector, { visible: true, timeout: 30_000 });
    await page.$eval(
      selector,
      (element, value) => {
        const input = element as HTMLInputElement;
        input.value = value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
      },
      format(date, PAGE_DATE_FORMAT),
    );
  }

  // The form validates in the page before it posts. A rejected range (the bank serves
  // three years back, no more) shows a message and never navigates, so that is watched for
  // alongside the navigation instead of waiting out a timeout.
  const navigation = page
    .waitForNavigation({ waitUntil: 'networkidle2', timeout: 60_000 })
    .then(() => null);
  await page.click(SUBMIT_SELECTOR);
  const rejection = await Promise.race([navigation, waitForValidationMessage(page)]);
  if (rejection !== null) {
    // Nothing navigates after a rejected form; do not leave the other waiter unhandled.
    navigation.catch(() => null);
    throw new Error(`Leumi rejected the foreign-currency date range: ${rejection}`);
  }
  await page.waitForSelector(`${ACTIVITY_TABLE_SELECTOR}, ${NO_DATA_SELECTOR}`, {
    timeout: 30_000,
  });

  // No named helper functions inside `evaluate`: runners that transpile on the fly (tsx)
  // wrap them in a helper that does not exist in the page.
  const scraped = await page.evaluate(
    (accountsSelector, tableSelector, fromSelector, toSelector) => {
      const table = document.querySelector(tableSelector);
      return {
        selectedAccount: document.querySelector<HTMLSelectElement>(accountsSelector)?.value ?? '',
        currencyLabel: document.querySelector<HTMLElement>('#lblCurrencyVal')?.innerText ?? '',
        asOfDate: document.querySelector<HTMLElement>('#lblAsOfVal')?.innerText ?? '',
        balance: document.querySelector<HTMLElement>('#lblOpeningBalanceVal')?.innerText ?? '',
        lastActionDate:
          document.querySelector<HTMLElement>('#lblLastActionDateVal')?.innerText ?? '',
        fromDate: document.querySelector<HTMLInputElement>(fromSelector)?.value ?? '',
        toDate: document.querySelector<HTMLInputElement>(toSelector)?.value ?? '',
        headers: table
          ? Array.from(table.querySelectorAll<HTMLElement>('tr.header th'), th => th.innerText)
          : null,
        rows: table
          ? Array.from(table.querySelectorAll('tr:not(.header)'), tr =>
              Array.from(tr.querySelectorAll<HTMLElement>('td'), td => td.innerText),
            )
          : [],
      };
    },
    ACCOUNTS_SELECTOR,
    ACTIVITY_TABLE_SELECTOR,
    FROM_DATE_SELECTOR,
    TO_DATE_SELECTOR,
  );

  if (scraped.selectedAccount !== account.value) {
    throw new Error(
      `Leumi foreign-currency page shows account ${scraped.selectedAccount}, expected ${account.value}`,
    );
  }

  const currencyLabel = cleanText(scraped.currencyLabel);
  const raw = {
    account,
    currencyLabel,
    currency: mapLeumiCurrencyLabel(currencyLabel),
    asOfDate: cleanText(scraped.asOfDate),
    balance: cleanText(scraped.balance),
    lastActionDate: cleanText(scraped.lastActionDate),
    fromDate: cleanText(scraped.fromDate),
    toDate: cleanText(scraped.toDate),
    // With no transactions in range the page has no table; the headers are then not
    // there to check, so the expected ones stand in.
    headers: scraped.headers ? scraped.headers.map(cleanText) : EXPECTED_HEADERS,
    transactions: scraped.rows.map(cells => {
      const [date, description, reference, debit, credit, balance, ...rest] = cells.map(cleanText);
      return {
        date,
        description,
        reference,
        debit,
        credit,
        balance,
        // Extra cells mean the table changed shape; keep them so validation fails loudly.
        ...(rest.length > 0 ? { unexpectedCells: rest } : {}),
      };
    }),
  };

  return validate(foreignAccountActivitySchema, raw, validateSchema);
}

/**
 * The first day the page will serve: the day after its `ExtendedActivityMinDate`
 * (`26/11/2024 00:00:00`), which the form's own check treats as excluded.
 */
async function readEarliestAvailableDate(page: Page): Promise<Date> {
  const minDate = await page.evaluate(() => {
    const value = (window as unknown as { ExtendedActivityMinDate?: unknown })
      .ExtendedActivityMinDate;
    return typeof value === 'string' ? value : null;
  });
  const match = minDate?.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) {
    throw new Error(
      `Leumi foreign-currency page did not state its earliest available date (got ${String(minDate)})`,
    );
  }
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]) + 1);
}

/** Resolves with the text of the form's validation message once one is showing. */
async function waitForValidationMessage(page: Page): Promise<string> {
  const handle = await page.waitForFunction(
    selector => {
      for (const element of Array.from(document.querySelectorAll(selector))) {
        const html = element as HTMLElement;
        const text = html.innerText.trim();
        const shown = html.offsetParent !== null && getComputedStyle(html).visibility === 'visible';
        if (text !== '' && shown) return text;
      }
      return false;
    },
    { timeout: 65_000, polling: 250 },
    VALIDATION_MESSAGE_SELECTOR,
  );
  return String(await handle.jsonValue());
}

/** `1,234.56` → `1234.56`. For callers turning a validated row into numbers. */
export function parseLeumiAmount(text: string): number {
  if (!/^-?\d{1,3}(,\d{3})*\.\d{2}$/.test(text)) {
    throw new Error(`Not a Leumi amount: "${text}"`);
  }
  return Number(text.replace(/,/g, ''));
}
