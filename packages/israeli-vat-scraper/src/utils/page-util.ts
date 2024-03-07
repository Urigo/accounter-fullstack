import { ElementHandle, Page } from 'puppeteer';
import type { Logger } from './types.js';

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const waitAndClick = async (page: Page, selector: string, logger: Logger): Promise<void> => {
  const button = await waitForSelectorPlus(page, selector, logger);
  if (!button) {
    logger.error(`Error finding button by selector ${selector}`);
    return;
  }
  await button.click();
  return;
};

export const waitForSelectorPlus = async (
  page: Page,
  selector: string,
  logger: Logger,
): Promise<ElementHandle<Element> | null> => {
  return page.waitForSelector(selector).catch(async () => {
    logger.debug(`Activating safety net for selector ${selector}`);
    await page.reload({ waitUntil: ['networkidle0', 'domcontentloaded'] });
    return page.waitForSelector(selector);
  });
};
