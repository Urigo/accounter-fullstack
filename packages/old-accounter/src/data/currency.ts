import { add, format, sub } from 'date-fns';
import { XMLParser } from 'fast-xml-parser';
import { Pool } from 'pg';
import XML from 'pixl-xml';
import puppeteer from 'puppeteer';
import type { Page } from 'puppeteer';

// TODO: Compare to this library: https://github.com/TobiasNickel/tXml

const currencies = ['USD', 'EUR', 'GBP'] as const;
type Currency = (typeof currencies)[number];

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
      SELECT * FROM accounter_schema.exchange_rates 
      ORDER BY exchange_date ASC
    `;
  const existingRates = await pool.query(existingRatesQuery);

  const dbData = new Map<string, Partial<Record<Currency, number | null>>>();
  for (const rate of existingRates.rows) {
    dbData.set(format(rate.exchange_date, 'yyyy-MM-dd'), {
      USD: rate.usd ? Number(rate.usd) : null,
      EUR: rate.eur ? Number(rate.eur) : null,
      GBP: rate.gbp ? Number(rate.gbp) : null,
    });
  }

  const res = await fetch(
    'https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_USD_ILS,RER_EUR_ILS,RER_GBP_ILS',
  );

  const XMLdata = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
  });
  const parsedXml = parser.parse(XMLdata);

  if (!parsedXml?.['message:StructureSpecificData']?.['message:DataSet']?.Series?.length) {
    console.log('No currency rates data fetched');
    return;
  }

  const govData = new Map<string, Partial<Record<Currency, number | null>>>();
  const series = parsedXml['message:StructureSpecificData']['message:DataSet']['Series'];
  for (const currencyData of series) {
    if (currencyData.Obs?.length) {
      const currency = currencyData['@_BASE_CURRENCY'] as Currency;
      if (!currencies.includes(currency)) {
        console.log(`Unsupported currency base ${currency}`);
        continue;
      }
      for (const obs of currencyData.Obs) {
        if (!govData.has(obs['@_TIME_PERIOD'])) {
          govData.set(obs['@_TIME_PERIOD'], {
            [currency]: Number(obs['@_OBS_VALUE']),
          });
        } else {
          govData.set(obs['@_TIME_PERIOD'], {
            ...govData.get(obs['@_TIME_PERIOD']),
            [currency]: Number(obs['@_OBS_VALUE']),
          });
        }
      }
    }
  }

  const newRecords: string[] = [];
  const newValues = [];
  let newValuesCount = 1;

  for (const [date, rates] of govData) {
    const dbRates = dbData.get(date);

    if (dbRates) {
      let diffCount = 1;
      const updatesParts: string[] = [];
      const values = [];
      for (const currency of currencies) {
        if (rates[currency] !== dbRates[currency]) {
          if (dbRates[currency] === null) {
            console.log(
              `Difference in ${currency} rate for ${date}: currently empty, updating value to ${rates[currency]}`,
            );
            updatesParts.push(`${currency.toLowerCase()} = $${diffCount}`);
            values.push(rates[currency] ?? null);
            diffCount++;
          } else {
            console.log(
              `Value of ${currency} rate for ${date} has changed! formerly ${dbRates[currency]}, now recorded as ${rates[currency]}. please address this manually.`,
            );
          }
        }
      }

      if (updatesParts.length) {
        values.push(date);
        const text = `
          UPDATE accounter_schema.exchange_rates
          SET ${updatesParts.join(', ')}
          WHERE exchange_date = $${diffCount} RETURNING *
        `;

        try {
          const res = await pool.query(text, values);
          console.log(res.rows[0]);
          console.log(format(res.rows[0].exchange_date, 'yyyyMMdd'));
        } catch (error) {
          // TODO: Log important checks
          console.log('error in update - ', error);
        }
      }
    } else if (date > '2009-12-31') {
      newRecords.push(
        `$${newValuesCount}, $${newValuesCount + 1}, $${newValuesCount + 2}, $${newValuesCount + 3}`,
      );
      newValues.push(date, rates.USD, rates.EUR, rates.GBP);
      newValuesCount += 4;
    }
  }

  if (newRecords.length) {
    const text = `
      INSERT INTO accounter_schema.exchange_rates 
      (exchange_date, usd, eur, gbp) VALUES (${newRecords.join('), (')}) RETURNING *
    `;

    try {
      const res = await pool.query(text, newValues);
      res.rows.map(row => {
        console.log(row);
        console.log(format(row.exchange_date, 'yyyyMMdd'));
      });
    } catch (error) {
      // TODO: Log important checks
      console.log('error in insert - ', error);
    }
  }
}
