import type { Page } from 'puppeteer';
import { newPageByYear } from '../utils/browser-util.js';
import { getReportsTable } from '../utils/evaluation-functions.js';
import { waitForSelectorPlus } from '../utils/page-util.js';
import type { Config, Logger, Report, ReportCommon } from '../utils/types.js';
import { UserPrompt } from '../utils/user-prompt.js';
import { MonthHandler } from './month-handler.js';

export class YearHandler {
  private config: Config;
  private prompt: UserPrompt;
  private location: string[];
  private months: number[] | null = null;
  private page: Page | null = null;

  constructor(
    config: Config,
    prompt: UserPrompt,
    location: string[],
    months: number[] | null = null,
  ) {
    this.config = config;
    this.prompt = prompt;
    this.location = location;
    this.months = months;
  }

  public handle = async (logger: Logger): Promise<Report[]> => {
    try {
      this.prompt.update(this.location, 'Scraping', logger);

      const baseYearReports = await this.getBasicReport(logger);

      if (!baseYearReports || baseYearReports.length === 0) {
        this.prompt.update(this.location, 'Done - No data found', logger);
        return [];
      }

      const reports: Report[] = [];

      await Promise.all(
        baseYearReports
          .map((report, index): { info: ReportCommon; index: number } => ({ info: report, index }))
          .filter(
            item =>
              !this.months || this.months.includes(parseInt(item.info.reportMonth.substring(0, 2))),
          )
          .map(async item => {
            const monthHandler = new MonthHandler(
              this.config,
              this.prompt,
              this.location,
              item.info,
              item.index,
            );

            return monthHandler.handle(logger).then(res => res || item.info);
          }),
      )
        .then(reportsList => reportsList.filter(report => report))
        .then(reportsList => {
          reports.push(...(reportsList as unknown as Report[]));
        });

      this.prompt.update(this.location, 'Done', logger);
      return reports;
    } catch (e) {
      this.page?.browser().close();
      this.prompt.addError(this.location, (e as Error)?.message || e, logger);
      return [];
    }
  };

  /** Get year's basic info */
  private getBasicReport = async (logger: Logger): Promise<ReportCommon[]> => {
    try {
      this.page = await newPageByYear(
        this.config.visibleBrowser,
        this.location[0] as string,
        logger,
      );

      await waitForSelectorPlus(this.page, '#ContentUsersPage_TblDuhot', logger);

      const reports = await this.page.$eval('#dgDuchot', getReportsTable);

      this.page.browser().close();

      return reports;
    } catch (e) {
      this.page?.browser().close();
      throw new Error(`getReportsTable - ${(e as Error)?.message || e}`);
    }
  };
}
