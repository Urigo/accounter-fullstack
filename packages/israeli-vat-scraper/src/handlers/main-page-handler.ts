import type { Page } from 'puppeteer';
import { newHomePage } from '../utils/browser-util.js';
import { parseDate } from '../utils/dates.js';
import { getSelectOptions } from '../utils/evaluation-functions.js';
import { waitForSelectorPlus } from '../utils/page-util.js';
import type { Config, Report } from '../utils/types.js';
import { UserPrompt } from '../utils/user-prompt.js';
import { YearHandler } from './year-handler.js';

export const homePageHandler = async (config: Config): Promise<Report[]> => {
  let page: Page | null = null;
  try {
    const prompt = new UserPrompt();

    page = await newHomePage(config.visibleBrowser, config.logger);
    config.logger.log('Logged in');

    /* get available years */
    await waitForSelectorPlus(page, '#ContentUsersPage_DdlTkufa', config.logger);
    const taxYears = await page.evaluate(
      getSelectOptions,
      'select#ContentUsersPage_DdlTkufa > option',
    );

    const reports: Report[] = [];

    const years: Record<number, number[]> = {};
    if (config.years) {
      for (const item of config.years) {
        if (typeof item === 'number') {
          years[item] = [];
        } else {
          years[item[0]] = item[1];
        }
      }
    }

    await Promise.all(
      taxYears.map(async year => {
        const numYear = parseInt(year.value);
        if (!years || years[numYear]) {
          const months = years[numYear]?.length ? years[numYear] : null;

          const reportsYearHandler = new YearHandler(config, prompt, [year.value], months);
          return reportsYearHandler.handle(config.logger);
        }
        return [];
      }),
    ).then(reportsLists => {
      for (const list of reportsLists) {
        reports.push(...list);
      }
    });

    page.browser().close();

    reports.sort(
      (a, b) =>
        (config.sortDescending
          ? parseDate(a.reportMonth) < parseDate(b.reportMonth) && 1
          : parseDate(a.reportMonth) > parseDate(b.reportMonth) && 1) || -1,
    );

    if (config.printErrors) {
      prompt.printErrors(config.logger);
    }

    return reports;
  } catch (e) {
    page?.browser().close();
    throw new Error(`reportsHandler - ${(e as Error)?.message || e}`);
  }
};
