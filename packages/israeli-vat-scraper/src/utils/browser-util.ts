import puppeteer, { Page } from 'puppeteer';
import { login } from '../handlers/login-handler.js';
import { waitAndClick, waitForSelectorPlus } from './page-util.js';
import type { Logger } from './types.js';

const nevigateYearToMonth = async (
  page: Page,
  monthIndex: number,
  logger: Logger,
): Promise<void> => {
  try {
    const selector = `#dgDuchot > tbody > tr:nth-child(${monthIndex + 2}) > td:nth-child(1) > a`;

    await waitAndClick(page, selector, logger);

    return;
  } catch (e) {
    throw new Error(`nevigateYearToMonth - ${(e as Error)?.message}`);
  }
};

export const newPageByMonth = async (
  showBrowser: boolean,
  year: string,
  monthIndex: number,
  logger: Logger,
): Promise<Page> => {
  try {
    const page = await newPageByYear(showBrowser, year, logger);

    await nevigateYearToMonth(page, monthIndex, logger);

    return page;
  } catch (e) {
    throw new Error(`newPageByYear - ${(e as Error)?.message}`);
  }
};

export const navigateHomeToYear = async (
  page: Page,
  year: string,
  logger: Logger,
): Promise<void> => {
  try {
    await waitForSelectorPlus(page, '#ContentUsersPage_DdlTkufa', logger);

    await page.select('#ContentUsersPage_DdlTkufa', year);

    return;
  } catch (e) {
    throw new Error(`navigateHomeToYear - ${(e as Error)?.message}`);
  }
};

export const newPageByYear = async (
  showBrowser: boolean,
  year: string,
  logger: Logger,
): Promise<Page> => {
  try {
    const page = await newHomePage(showBrowser, logger);

    await navigateHomeToYear(page, year, logger);

    return page;
  } catch (e) {
    throw new Error(`newPageByYear - ${(e as Error)?.message}`);
  }
};

export const newHomePage = async (showBrowser: boolean, logger: Logger): Promise<Page> => {
  try {
    const browser = await puppeteer.launch({
      headless: !showBrowser,
    });
    const page = (await browser.pages())[0];
    if (!page) {
      throw new Error('Failed to get browser page');
    }
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36',
    );

    await login(page, logger);

    await page.goto('https://www.misim.gov.il/emdvhmfrt/wViewDuchot.aspx', {
      waitUntil: ['networkidle2', 'domcontentloaded'],
    });

    return page;
  } catch (e) {
    throw new Error(`newHomePage - ${(e as Error)?.message}`);
  }
};
