import { Pool } from 'pg';
import { add, differenceInDays, format, sub } from 'date-fns';
import XML from 'pixl-xml';
import puppeteer from 'puppeteer';

// TODO: Compare to this library: https://github.com/TobiasNickel/tXml

async function getCurrencyRatesForDate(currentDate: Date, page: puppeteer.Page) {
  const url = `https://www.boi.org.il/currency.xml?rdate=${format(currentDate, 'yyyyMMdd')}`;
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
      textRes = textRes.replace(/(\r\n|\n|\r)/gm, '').replaceAll(' ', '');

      const currencyRates: any = XML.parse(textRes);

      if (currencyRates.CURRENCY) {
        dailyDollarRate = currencyRates.CURRENCY.find((x: any) => x.CURRENCYCODE === 'USD').RATE;
        dailyEuroRate = currencyRates.CURRENCY.find((x: any) => x.CURRENCYCODE === 'EUR').RATE;
        dailyGBPRate = currencyRates.CURRENCY.find((x: any) => x.CURRENCYCODE === 'GBP').RATE;
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
      const result = await getCurrencyRatesForDate(currentDate, page);
      return result;
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

        const values = [
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

          const values = [
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
