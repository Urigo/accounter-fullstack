import { expect, test, type Page, type Request } from '@playwright/test';
import { ACME, GLOBEX, MERGEABLE, PAGE_SIZE } from './data.js';
import {
  chargesUrl,
  errorToasts,
  expectCharges,
  groupFilter,
  isAllCharges,
  pageOf,
  paginationOf,
  recordErrorToasts,
  requestDone,
  settle,
  shownCharges,
  startHoldingProxy,
  trackAllCharges,
  urlState,
} from './helpers.js';

/**
 * The All Charges screen (`/charges`) against the real server and database.
 *
 * Each test checks the rows on screen and the AllCharges requests the page sent: the screen takes
 * over the route loader's request on a cold load, refetches on every page and filter change, and
 * must never show rows for variables other than the current ones.
 */

const ACME_FILTER = groupFilter(ACME);
const GLOBEX_FILTER = groupFilter(GLOBEX);

// A failed operation surfaces as an error toast, even when the rows under test look right. Every
// error toast shown during the test is recorded, so one that has already closed (the app's close
// after 5 s) still fails it; checking the screen at the end would miss those, and a retrying
// `toHaveCount(0)` would pass by waiting the last one out.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(recordErrorToasts);
});

test.afterEach(async ({ page }) => {
  expect(await errorToasts(page)).toEqual([]);
});

/**
 * KNOWN ISSUE, recorded here so the suite fails once it is fixed: applying a new filter while on a
 * later page first sends a request for the new filter on the *old* page, then the one for page 0.
 * `useUrlFilterState` sets the filter state at once but drops `?page=` only in the navigation its
 * effect makes afterwards, so for one render the screen holds the new filter with the old page.
 * The rows end up right; the first request is wasted. Remove this entry from the expected lists
 * when the two land in one update.
 */
const STALE_PAGE_REQUEST = (search: string, page: number): [string, number] => [search, page];

/** Opens the filters dialog; its trigger is labelled "Filters (N active)" for screen readers. */
async function openFilters(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Filters \(\d+ active\)/ }).click();
  await expect(page.getByRole('heading', { name: 'Filter Charges' })).toBeVisible();
}

/** Applies a new free-text search through the filters dialog, keeping the rest of the filter. */
async function searchThroughDialog(page: Page, text: string): Promise<void> {
  await openFilters(page);
  const dialog = page.getByRole('dialog');
  await dialog.locator('#charges-free-text').fill(text);
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(dialog).toBeHidden();
}

test('a cold load with a filter in the URL sends one request, the route loader’s', async ({
  page,
}) => {
  const calls = trackAllCharges(page);

  await page.goto(chargesUrl(ACME_FILTER));

  await expectCharges(page, pageOf(ACME, 0));
  await expect(paginationOf(page).getByRole('button', { name: '2', exact: true })).toBeVisible();
  await settle(page);
  expect(calls).toEqual([{ page: 0, filters: ACME_FILTER }]);
});

test('a cold load with no filter sends nothing and asks for one', async ({ page }) => {
  const calls = trackAllCharges(page);

  await page.goto(chargesUrl());

  await expect(page.getByText('Please apply filters')).toBeVisible();
  await settle(page);
  expect(calls).toEqual([]);
});

test('next and previous page', async ({ page }) => {
  const calls = trackAllCharges(page);
  await page.goto(chargesUrl(ACME_FILTER));
  await expectCharges(page, pageOf(ACME, 0));

  await paginationOf(page).getByLabel('Go to next page').click();
  await expectCharges(page, pageOf(ACME, 1));
  expect(urlState(page).page).toBe(1);

  await paginationOf(page).getByLabel('Go to previous page').click();
  await expectCharges(page, pageOf(ACME, 0));
  expect(urlState(page).page).toBe(0);

  await settle(page);
  expect(calls.map(call => call.page)).toEqual([0, 1, 0]);
});

/**
 * The bug found in review of PR 5120: the user leaves page 0 while the loader's request is still
 * streaming (its deferred part not yet in), the request then finishes, and the user comes back.
 * Nobody was following the request when it finished, so the loader still holds it, complete and
 * for exactly these variables. The screen must fetch page 0 again rather than take that request
 * over: taking it over sent nothing, and the screen kept showing urql's last result, page 1.
 *
 * The deferred part is held back by a proxy until the screen is on page 1, which makes the order
 * deterministic.
 */
test('page 0 → 1 → 0 when the loader’s deferred response lands on page 1', async ({ page }) => {
  const proxy = await startHoldingProxy();
  try {
    let heldRequest: Request | undefined;
    await page.route('**/graphql**', async route => {
      if (!heldRequest && isAllCharges(route.request())) {
        heldRequest = route.request();
        const target = new URL(route.request().url());
        await route.continue({ url: `${proxy.url}${target.pathname}${target.search}` });
        return;
      }
      await route.continue();
    });
    const calls = trackAllCharges(page);

    await page.goto(chargesUrl(ACME_FILTER));
    await proxy.firstPartSent;
    // The first part carries the rows and the page count; the deferred fields are still held.
    await expectCharges(page, pageOf(ACME, 0));

    await paginationOf(page).getByLabel('Go to next page').click();
    await expectCharges(page, pageOf(ACME, 1));

    // Now let the loader's response finish, while the screen shows page 1.
    const done = requestDone(page, heldRequest!);
    proxy.release();
    await done;
    await settle(page);
    await expectCharges(page, pageOf(ACME, 1));

    await paginationOf(page).getByLabel('Go to previous page').click();
    await expectCharges(page, pageOf(ACME, 0));
    await settle(page);
    expect(calls.map(call => call.page)).toEqual([0, 1, 0]);
  } finally {
    await proxy.close();
  }
});

test('filter A → B → A', async ({ page }) => {
  const calls = trackAllCharges(page);
  await page.goto(chargesUrl(ACME_FILTER, 1));
  await expectCharges(page, pageOf(ACME, 1));

  await searchThroughDialog(page, GLOBEX.search);
  await expectCharges(page, GLOBEX.descriptions);
  // A new filter starts over from the first page, and a single page needs no pagination.
  expect(urlState(page)).toMatchObject({ page: 0, filter: { freeText: GLOBEX.search } });
  await expect(paginationOf(page)).toBeHidden();

  await searchThroughDialog(page, ACME.search);
  await expectCharges(page, pageOf(ACME, 0));
  expect(urlState(page)).toMatchObject({ page: 0, filter: { freeText: ACME.search } });
  await expect(paginationOf(page).getByRole('button', { name: '2', exact: true })).toBeVisible();

  await settle(page);
  expect(calls.map(call => [call.filters.freeText, call.page])).toEqual([
    [ACME.search, 1],
    STALE_PAGE_REQUEST(GLOBEX.search, 1),
    [GLOBEX.search, 0],
    [ACME.search, 0],
  ]);
});

test('clearing the filter shows every charge, newest first', async ({ page }) => {
  const calls = trackAllCharges(page);
  await page.goto(chargesUrl(GLOBEX_FILTER));
  await expectCharges(page, GLOBEX.descriptions);

  await openFilters(page);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Clear all', exact: true }).last().click();
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(dialog).toBeHidden();

  // Only the sort order is left, so nothing narrows the list: a full first page, newest first.
  // The mergeable charges are the newest, but the merge test may already have merged them, so
  // the assertion is on the other groups.
  await expect.poll(async () => (await shownCharges(page)).length).toBe(PAGE_SIZE);
  const shown = await shownCharges(page);
  expect(shown.filter(name => name.startsWith('Globex'))).toEqual(
    [...GLOBEX.descriptions].reverse(),
  );
  const acme = shown.filter(name => name.startsWith('Acme'));
  expect(acme).toEqual([...ACME.descriptions].reverse().slice(0, acme.length));
  expect(urlState(page).filter).toEqual({ sortBy: { asc: false, field: 'DATE' } });
  await expect(paginationOf(page)).toBeVisible();

  await settle(page);
  expect(calls).toEqual([
    { page: 0, filters: GLOBEX_FILTER },
    { page: 0, filters: { sortBy: { asc: false, field: 'DATE' } } },
  ]);
});

test('browser back and forward', async ({ page }) => {
  const calls = trackAllCharges(page);
  await page.goto(chargesUrl(ACME_FILTER));
  await expectCharges(page, pageOf(ACME, 0));
  await paginationOf(page).getByLabel('Go to next page').click();
  await expectCharges(page, pageOf(ACME, 1));
  await searchThroughDialog(page, GLOBEX.search);
  await expectCharges(page, GLOBEX.descriptions);

  await page.goBack();
  await expectCharges(page, pageOf(ACME, 1));
  expect(urlState(page)).toMatchObject({ page: 1, filter: ACME_FILTER });

  await page.goBack();
  await expectCharges(page, pageOf(ACME, 0));
  expect(urlState(page)).toMatchObject({ page: 0, filter: ACME_FILTER });

  await page.goForward();
  await expectCharges(page, pageOf(ACME, 1));

  await page.goForward();
  await expectCharges(page, GLOBEX.descriptions);

  await settle(page);
  expect(calls.map(call => [call.filters.freeText, call.page])).toEqual([
    [ACME.search, 0],
    [ACME.search, 1],
    STALE_PAGE_REQUEST(GLOBEX.search, 1),
    [GLOBEX.search, 0],
    [ACME.search, 1],
    [ACME.search, 0],
    [ACME.search, 1],
    [GLOBEX.search, 0],
  ]);
});

test('an out-of-range page in the URL still shows the page count', async ({ page }) => {
  const calls = trackAllCharges(page);
  await page.goto(chargesUrl(ACME_FILTER, 7));

  const pagination = paginationOf(page);
  await expect(pagination.getByRole('button', { name: '2', exact: true })).toBeVisible();
  await settle(page);
  expect(await shownCharges(page)).toEqual([]);
  expect(calls).toEqual([{ page: 7, filters: ACME_FILTER }]);

  // The count is there to go back with.
  await pagination.getByRole('button', { name: '1', exact: true }).click();
  await expectCharges(page, pageOf(ACME, 0));
  expect(urlState(page).page).toBe(0);
});

test.describe(() => {
  // The merge can't be undone and the database is seeded once per run (a retry gets the same web
  // servers), so a retry would find one charge and fail for that instead of the real reason.
  test.describe.configure({ retries: 0 });

  test('the list refreshes after merging two charges', async ({ page }) => {
    const calls = trackAllCharges(page);
    await page.goto(chargesUrl(groupFilter(MERGEABLE)));
    await expectCharges(page, MERGEABLE.descriptions);
    await settle(page);
    const before = calls.length;

    for (const checkbox of await page.getByRole('checkbox', { name: 'Select row' }).all()) {
      await checkbox.check();
    }
    // The merge button is a tooltip trigger inside the dialog trigger; click the outermost.
    await page.locator('[data-slot="dialog-trigger"]:has(svg.lucide-merge)').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Merge Charges' })).toBeVisible();
    // Keep the first charge, and its description.
    await dialog.getByRole('checkbox').first().click();
    await dialog.getByRole('button', { name: 'Accept' }).click();
    await expect(dialog).toBeHidden();

    await expectCharges(page, [MERGEABLE.descriptions[0]!]);
    expect(calls.length).toBeGreaterThan(before);
  });
});
