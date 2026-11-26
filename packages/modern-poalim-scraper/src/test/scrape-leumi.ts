// Script to try the Leumi scraper against the real site. Run with:
//   tsx packages/modern-poalim-scraper/src/test/scrape-leumi.ts
//
// Sign-in, one of:
//   LEUMI_USERNAME + LEUMI_PASSWORD   the scraper signs in
//   (neither)                         a browser opens on the sign-in page; sign in by hand
//   LEUMI_BROWSER_URL                 attach to a Chrome that is already signed in, started
//                                     with --remote-debugging-port (e.g. http://127.0.0.1:9333)
//
// LEUMI_OUTPUT_DIR  write every response as JSON into this folder. Without it only counts
//                   and validation results are printed — never account data.
// LEUMI_MONTHS      how many months back to read (default 36).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { addDays, addMonths, format, startOfMonth, subMonths } from 'date-fns';
import dotenv from 'dotenv';
import puppeteer, { type Browser } from 'puppeteer';
import { init } from '../index.js';
import { leumi } from '../scrapers/leumi/index.js';
import type { LeumiResult } from '../scrapers/leumi/index.js';

dotenv.config({ path: [`.env`, `../../.env`] });

const outputDir = process.env['LEUMI_OUTPUT_DIR'];
const months = Number(process.env['LEUMI_MONTHS'] ?? 36);

let failures = 0;

function report<T>(name: string, result: LeumiResult<T>, describe: (data: T) => string): T {
  if (outputDir) {
    writeFileSync(join(outputDir, `${name}.json`), JSON.stringify(result.data, null, 2));
  }
  const verdict = result.isValid === null ? 'unchecked' : result.isValid ? 'valid' : 'INVALID';
  console.log(`${name}: ${verdict} — ${describe(result.data)}`);
  if (result.isValid === false) {
    failures++;
    // Paths and messages only: an issue's `input` could be account data.
    const seen = new Set<string>();
    for (const issue of result.errors ?? []) {
      const path = issue.path
        .map(part => (typeof part === 'number' ? '[]' : String(part)))
        .join('.');
      const line = `  ${path}: ${issue.message}`;
      if (!seen.has(line)) {
        seen.add(line);
        console.log(line);
      }
    }
  }
  return result.data;
}

async function main() {
  if (outputDir) mkdirSync(outputDir, { recursive: true });

  const browserUrl = process.env['LEUMI_BROWSER_URL'];
  const username = process.env['LEUMI_USERNAME'];
  const password = process.env['LEUMI_PASSWORD'];

  let attached: Browser | undefined;
  let close: () => Promise<unknown>;
  let scraper: Awaited<ReturnType<typeof leumi>>;

  if (browserUrl) {
    attached = await puppeteer.connect({ browserURL: browserUrl, defaultViewport: null });
    const page = (await attached.pages()).find(p => p.url().includes('hb2.bankleumi.co.il'));
    if (!page) throw new Error(`No Leumi tab found in the browser at ${browserUrl}`);
    scraper = await leumi(page, undefined, { alreadySignedIn: true });
    // Leave the person's browser open.
    close = () => attached!.disconnect();
  } else {
    const scrapers = await init({ headless: false });
    close = scrapers.close;
    scraper = await scrapers.leumi(username && password ? { username, password } : undefined);
  }

  try {
    const toDate = new Date();
    // The bank serves three years back; one day inside that, so a 36-month run is accepted.
    const fromDate = addDays(subMonths(toDate, months), 1);

    const accounts = report(
      'accounts',
      await scraper.getAccounts(),
      d => `${d.AccountsItems.length} account(s)`,
    );
    report(
      'all-accounts',
      await scraper.getAllAccounts(),
      d => `${d.RequestsItems.length} group(s)`,
    );
    report(
      'securities-profile',
      await scraper.getSecuritiesProfile(),
      d => `${d.data.user.Portfolios.length} portfolio(s)`,
    );

    const mortgages = report(
      'mortgages',
      await scraper.getMortgages(),
      d => `${d.loanMortgageItems.length} mortgage(s)`,
    );
    for (const [i, item] of mortgages.loanMortgageItems.entries()) {
      report(
        `mortgage-${i}-tracks`,
        await scraper.getMortgageTracks(item.MortgageDetail.mortgageKey),
        d =>
          `${d.MortgageDetails.loansItems.length} track(s), ${d.MortgageDetails.loansItems[0]?.paymentItems.length ?? 0} payment(s)`,
      );
    }

    for (const account of accounts.AccountsItems) {
      const index = account.AccountIndex;
      const tag = `account-${index}`;
      report(
        `${tag}-summary`,
        await scraper.getSummary(index),
        d => `${d.TotalPerTypeItems.length} product total(s)`,
      );
      report(
        `${tag}-ils`,
        await scraper.getIlsTransactions(index, { fromDate, toDate }),
        d =>
          `${d.HistoryTransactionsItems?.length ?? 0} booked, ${d.TodayTransactionsItems?.length ?? 0} today`,
      );
      report(
        `${tag}-ils-checks`,
        await scraper.getIlsTransactions(index, { fromDate, toDate, filter: 'checks' }),
        d => `${d.HistoryTransactionsItems?.length ?? 0} cheque row(s)`,
      );
      report(
        `${tag}-mortgage-balances`,
        await scraper.getMortgageBalances(index),
        d => `${d.mortgageDataItems?.length ?? 0} mortgage(s)`,
      );
      report(`${tag}-deposits`, await scraper.getDeposits(index), d =>
        d ? `${d.depositsAndSavingsItems.length} deposit(s)` : 'none',
      );
      report(`${tag}-deposit-totals`, await scraper.getDepositTotals(index), () => 'ok');
      report(`${tag}-money-market`, await scraper.getMoneyMarketProducts(index), () => 'ok');
      report(
        `${tag}-card-lines`,
        await scraper.getCreditCardLines(index),
        d => `${d.cardItems.length} card(s)`,
      );

      const cards = report(
        `${tag}-cards`,
        await scraper.getCreditCards(index),
        d => `${d.CreditCardsItems.length} bank card(s), ${d.OtherCreditCardsItems.length} other`,
      );
      for (const card of cards.CreditCardsItems) {
        const ref = { accountIndex: index, cardIndex: card.CardIndex };
        const cardTag = `${tag}-card-${card.CardIndex}`;
        report(`${cardTag}-totals`, await scraper.getCreditCardTotals(ref), () => 'ok');
        report(
          `${cardTag}-cycles`,
          await scraper.getCreditCardCycles(ref),
          d => `${d.Graph?.DebitMonthItems.length ?? 0} listed cycle(s)`,
        );
        report(`${cardTag}-payback`, await scraper.getCreditCardPayback(ref), () => 'ok');

        let cycle = startOfMonth(addMonths(toDate, 1));
        let total = 0;
        let empty = 0;
        for (let i = 0; i <= months; i++) {
          const cycleDate = `${format(cycle, 'yyyy-MM')}-01T00:00:00`;
          const result = await scraper.getCreditCardTransactions(ref, cycleDate);
          const tabs = result.data.Activity?.TabNisTransactionItems ?? [];
          const count = tabs.reduce((sum, tab) => sum + tab.NisTransactionItems.length, 0);
          const foreign = result.data.Activity?.TabForeignTransactionItems.length ?? 0;
          total += count;
          if (!result.data.Activity) empty++;
          report(`${cardTag}-cycle-${format(cycle, 'yyyy-MM')}`, result, () =>
            result.data.Activity
              ? `${count} shekel row(s), ${foreign} foreign table(s)`
              : 'no activity',
          );
          cycle = subMonths(cycle, 1);
        }
        console.log(
          `${cardTag}: ${total} transaction(s) over ${months + 1} cycle(s), ${empty} without activity`,
        );
      }
    }

    // Last: this part navigates the page away from the account home.
    const foreignAccounts = await scraper.getForeignAccounts();
    console.log(`foreign-accounts: ${foreignAccounts.length}`);
    for (const account of foreignAccounts) {
      report(
        `foreign-${account.value}`,
        await scraper.getForeignTransactions(account, { fromDate, toDate }),
        d => `${d.currency ?? 'unknown currency'}, ${d.transactions.length} transaction(s)`,
      );
    }

    console.log(
      failures === 0
        ? '\nAll responses matched their schemas.'
        : `\n${failures} response(s) did not match their schema.`,
    );
  } finally {
    await close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
