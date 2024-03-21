import { add, differenceInDays, format, sub } from 'date-fns';
import { Pool } from 'pg';
import XML from 'pixl-xml';
import puppeteer from 'puppeteer';
import type { Page } from 'puppeteer';

// TODO: Compare to this library: https://github.com/TobiasNickel/tXml

async function getCurrencyRatesForDate(currentDate: Date, page: Page) {
  const url = `https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_USD_ILS,RER_EUR_ILS,RER_GBP_ILS?startperiod=${format(
    currentDate,
    'yyyy-MM-dd',
  )}&endperiod=${format(currentDate, 'yyyy-MM-dd')}`;
  // console.log(url);
  let dailyDollarRate = 0;
  let dailyEuroRate = 0;
  let dailyGBPRate = 0;

  await (async () => {
    try {
      await page.goto(url);
      // await page.screenshot({ path: 'example.png' });
      let textRes = (await page.evaluate(
        'document.getElementById("webkit-xml-viewer-source-xml").innerHTML',
      )) as string;

      const currencyRates: any = XML.parse(textRes);

      if (currencyRates['message:DataSet']) {
        dailyDollarRate = currencyRates['message:DataSet'].Series.find(
          (x: any) => x.BASE_CURRENCY === 'USD',
        ).Obs.OBS_VALUE;
        dailyEuroRate = currencyRates['message:DataSet'].Series.find(
          (x: any) => x.BASE_CURRENCY === 'EUR',
        ).Obs.OBS_VALUE;
        dailyGBPRate = currencyRates['message:DataSet'].Series.find(
          (x: any) => x.BASE_CURRENCY === 'GBP',
        ).Obs.OBS_VALUE;
      } else if (
        currencyRates.ERROR1 == 'Requested date is invalid or' &&
        currencyRates.ERROR2 == 'No exchange rate published for this date' &&
        currencyRates.ERROR3 == 'ATTENTION: Date should be in format YYYYMMDD'
      ) {
        console.log(`regular error missing ${format(currentDate, 'yyyyMMdd')}`);
      } else if (
        currencyRates.ERROR1 == 'Requesteddateisinvalidor' &&
        currencyRates.ERROR2 == 'Noexchangeratepublishedforthisdate' &&
        currencyRates.ERROR3 == 'ATTENTION:DateshouldbeinformatYYYYMMDD'
      ) {
        console.log(`regular error missing ${format(currentDate, 'yyyyMMdd')}`);
      } else {
        console.error(`What is that? ${JSON.stringify(currencyRates)}`);
      }
    } catch (error) {
      console.error('Error For - ', url);
      console.log(error);
      return undefined;
    }
  })();

  if (dailyDollarRate != 0 && dailyEuroRate != 0 && dailyGBPRate != 0) {
    return {
      dollarRate: dailyDollarRate,
      euroRate: dailyEuroRate,
      gbpRate: dailyGBPRate,
    };
  }
  return undefined;
}

export async function getCurrencyRates(pool: Pool) {
  const existingRatesQuery = `
      SELECT exchange_date FROM accounter_schema.exchange_rates 
      ORDER BY exchange_date DESC
      LIMIT 1
    `;
  const existingRates = await pool.query(existingRatesQuery);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  for (
    let currentDate = add(new Date(existingRates.rows[0].exchange_date), {
      days: 1,
    });
    differenceInDays(Date.now(), currentDate) >= 2;
    currentDate = add(currentDate, { days: 1 })
  ) {
    await (async () => {
      const currencyRates = await getCurrencyRatesForDate(currentDate, page);

      if (currencyRates) {
        const text = `
            INSERT INTO accounter_schema.exchange_rates 
            (exchange_date, usd, eur, gbp) VALUES ($1, $2, $3, $4) RETURNING *
          `;

        const values: any[] = [
          format(currentDate, 'yyyy-MM-dd'),
          currencyRates.dollarRate,
          currencyRates.euroRate,
          currencyRates.gbpRate,
        ];

        try {
          const res = await pool.query(text, values);
          console.log(res.rows[0]);
          console.log(format(res.rows[0].exchange_date, 'yyyyMMdd'));
        } catch (error) {
          // TODO: Log important checks
          console.log('error in insert - ', error);
          // console.log('nothing');
        }
      }
    })();
  }
}

export async function compareCurrencyRatesToDB(pool: Pool) {
  const existingRatesQuery = `
      SELECT exchange_date FROM accounter_schema.exchange_rates 
      ORDER BY exchange_date DESC
      LIMIT 1
    `;
  const existingRates = await pool.query(existingRatesQuery);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  for (
    let currentDate = add(new Date(existingRates.rows[0].exchange_date), {
      days: 1,
    });
    currentDate >= sub(new Date(), { years: 2 });
    currentDate = sub(currentDate, { days: 1 })
  ) {
    await (async () => {
      const currencyRates = await getCurrencyRatesForDate(currentDate, page);

      if (currencyRates) {
        const getDBForDate = `
          SELECT * FROM accounter_schema.exchange_rates 
          WHERE exchange_date = '${format(currentDate, 'yyyy-MM-dd')}';
        `;
        const existingRate = await pool.query(getDBForDate);

        if (existingRate.rowCount === 0) {
          console.log(`Not in DB but in website ${format(currentDate, 'yyyy-MM-dd')}`);

          const text = `
            INSERT INTO accounter_schema.exchange_rates 
            (exchange_date, usd, eur) VALUES ($1, $2, $3) RETURNING *
          `;

          const values: any[] = [
            format(currentDate, 'yyyy-MM-dd'),
            currencyRates.dollarRate,
            currencyRates.euroRate,
          ];

          try {
            const res = await pool.query(text, values);
            console.log(res.rows[0]);
            console.log(format(res.rows[0].exchange_date, 'yyyyMMdd'));
          } catch (error) {
            // TODO: Log important checks
            console.log('error in insert - ', error);
            // console.log('nothing');
          }
        } else if (
          parseFloat(currencyRates.dollarRate.toString()).toFixed(4) ==
            parseFloat(existingRate.rows[0].usd).toFixed(4) &&
          parseFloat(currencyRates.euroRate.toString()).toFixed(4) ==
            parseFloat(existingRate.rows[0].eur).toFixed(4)
        ) {
          console.log(`Same for ${format(currentDate, 'yyyy-MM-dd')}`);
        } else {
          console.error(`Different for ${format(currentDate, 'yyyy-MM-dd')}`);
          console.log(existingRate.rows[0].usd);
          console.log(existingRate.rows[0].eur);
          console.log(existingRate.rows[0].exchange_date);
        }
      } else {
        console.log(`no currency rates for ${format(currentDate, 'yyyy-MM-dd')}`);
      }
    })();
  }
  await browser.close();
}
