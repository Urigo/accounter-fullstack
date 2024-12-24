import type { Browser, Frame, Page } from 'puppeteer';

export async function newPage(browser: Browser): Promise<Page> {
  // creates new page in browser
  const VIEWPORT_WIDTH = 1024;
  const VIEWPORT_HEIGHT = 768;

  const page = await browser.newPage();

  await page.setViewport({
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
  });

  return page;
}

export async function waitUntilElementFound(
  page: Page | Frame,
  elementSelector: string,
  onlyVisible = false,
  timeout = 10_000,
) {
  // console.debug('waitUntilElementFound', { elementSelector, onlyVisible, timeout });
  await page.waitForSelector(elementSelector, { visible: onlyVisible, timeout });
}
