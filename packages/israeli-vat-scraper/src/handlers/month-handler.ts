import type { Page } from 'puppeteer';
import { newPageByMonth, newPageByYear } from '../utils/browser-util.js';
import { getReportDetails, getReportExpansionTitle } from '../utils/evaluation-functions.js';
import { waitAndClick, waitForSelectorPlus } from '../utils/page-util.js';
import type {
  Config,
  Logger,
  Report,
  ReportCommon,
  ReportDetails,
  ReportExpansion,
} from '../utils/types.js';
import { UserPrompt } from '../utils/user-prompt.js';
import { MonthFixesHandler } from './month-fixes-handler.js';
import { MonthInputsHandler } from './month-inputs-handler.js';
import { MonthSalesHandler } from './month-sales-handler.js';

export class MonthHandler {
  private config: Config;
  private prompt: UserPrompt;
  private location: string[];
  private report: Report;
  private index: number;
  private page: Page | null = null;

  constructor(
    config: Config,
    prompt: UserPrompt,
    location: string[],
    report: ReportCommon,
    index: number,
    page?: Page,
  ) {
    this.config = config;
    this.prompt = prompt;
    this.location = [...location, report.reportMonth.substring(0, 2)];
    this.report = report;
    this.index = index;
    this.page = page || null;
  }

  public handle = async (logger: Logger): Promise<Report | undefined> => {
    try {
      this.prompt.update(this.location, 'Fetching details', logger);

      const additionalDetailsPromise = this.getReportAdditionalDetails(logger).catch((e: Error) => {
        this.prompt.addError(this.location, e.message, logger);
        this.page?.browser().close();
        return undefined;
      });

      const reportExpansionPromise = this.config.expandData
        ? this.getExpansions(logger)
        : undefined;

      await Promise.all([additionalDetailsPromise, reportExpansionPromise]).then(res => {
        if (!res[0]) {
          throw new Error('Failed to fetch report additional details');
        }
        this.report.additionalDetails = res[0];
        if (!res[1]) {
          throw new Error('Failed to fetch report expansion');
        }
        this.report.reportExpansion = res[1];
      });

      this.prompt.update(this.location, 'Done', logger);
      return this.report;
    } catch (e) {
      this.prompt.addError(this.location, (e as Error)?.message || e, logger);
      return undefined;
    }
  };

  private getReportAdditionalDetails = async (
    logger: Logger,
  ): Promise<ReportDetails | undefined> => {
    this.page ||= await newPageByYear(
      this.config.visibleBrowser,
      this.location[0] as string,
      logger,
    );

    const selector = `#dgDuchot > tbody > tr:nth-child(${
      this.index + 2
    }) > td:nth-child(7) > table > tbody > tr > td:nth-child(1) > input`;
    await waitAndClick(this.page, selector, logger);

    const detailsTable = await waitForSelectorPlus(
      this.page,
      '#ContentUsersPage_ucPratimNosafimDuchot1_TblPerutDoch',
      logger,
    );

    const additionalDetails = await detailsTable?.evaluate(getReportDetails);

    this.page.browser().close();

    return additionalDetails;
  };

  private getExpansions = async (logger: Logger) => {
    try {
      this.prompt.update(this.location, 'Fetching expansion', logger);

      const page = await newPageByMonth(
        this.config.visibleBrowser,
        this.location[0] as string,
        this.index,
        logger,
      );

      const expansionCorePromise = this.getReportExpansion(page, logger);

      const inputsPromise = new MonthInputsHandler(
        this.config,
        this.prompt,
        this.location,
        this.index,
      ).handle(logger);

      const salesPromise = new MonthSalesHandler(
        this.config,
        this.prompt,
        this.location,
        this.index,
      ).handle(logger);

      const fixedInvoicesPromise = new MonthFixesHandler(
        this.config,
        this.prompt,
        this.location,
        this.index,
      ).handle(logger);

      const reportExpansion: ReportExpansion | undefined = await Promise.all([
        expansionCorePromise,
        inputsPromise,
        salesPromise,
        fixedInvoicesPromise,
      ]).then(res => {
        if (!res[0] || !res[1] || !res[2] || !res[3]) {
          return undefined;
        }
        return {
          ...res[0],
          inputs: res[1],
          sales: res[2],
          fixedInvoices: res[3],
        };
      });

      page.browser().close();

      if (!reportExpansion) {
        return undefined;
      }

      return reportExpansion;
    } catch (e) {
      this.prompt.addError([...this.location, 'Expansions'], (e as Error)?.message || e, logger);
      return undefined;
    }
  };

  private getReportExpansion = async (
    page: Page,
    logger: Logger,
  ): Promise<ReportExpansion | undefined> => {
    const location = [...this.location, 'Title'];
    try {
      // get title
      this.prompt.update(location, 'Fetching title...', logger);
      await waitForSelectorPlus(page, '#shaamcontent', logger);

      const titleTable = await waitForSelectorPlus(
        page,
        '#shaamcontent > table > tbody > tr:nth-child(2) > td > table',
        logger,
      );
      if (!titleTable) {
        this.prompt.addError(location, 'Error fetching title', logger);
        return undefined;
      }

      const reportExpansion = await titleTable.evaluate(getReportExpansionTitle);

      this.prompt.update(location, 'Done', logger);
      return reportExpansion;
    } catch (e) {
      this.prompt.addError(location, (e as Error)?.message || e, logger);
      return undefined;
    }
  };
}
