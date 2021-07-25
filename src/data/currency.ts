import { Pool } from 'pg';
import { add, differenceInDays, format } from 'date-fns';
import fetch from 'node-fetch';
import XML from 'pixl-xml';
import AbortController from 'abort-controller';

// TODO: Compare to this library: https://github.com/TobiasNickel/tXml

async function getCurrencyRatesForDate(currentDate: Date) {
  const url = `https://www.boi.org.il/currency.xml?rdate=${format(
    currentDate,
    'yyyyMMdd'
  )}`;
  console.log(url);

  let dailyDollarRate = 0;
  let dailyEuroRate = 0;

  const controller = new AbortController();
  const requestTimeout = setTimeout(() => {
    controller.abort();
  }, 7000);

  await (async () => {
    try {
      let response = await fetch(url, { signal: controller.signal });
      let textRes = await response.text();
      let currencyRates: any = XML.parse(textRes);

      if (currencyRates.CURRENCY) {
        dailyDollarRate = currencyRates.CURRENCY.find(
          (x: any) => x.CURRENCYCODE === 'USD'
        ).RATE;
        dailyEuroRate = currencyRates.CURRENCY.find(
          (x: any) => x.CURRENCYCODE === 'EUR'
        ).RATE;
      }
    } catch (error) {
      console.log(error);
    } finally {
      clearTimeout(requestTimeout);
    }
  })();

  console.log('got the rates- ', dailyDollarRate);
  if (dailyDollarRate != 0 && dailyEuroRate != 0) {
    return {
      dollarRate: dailyDollarRate,
      euroRate: dailyEuroRate,
    };
  } else {
    let url = `https://www.bankhapoalim.co.il/he/coin-rates?date=${format(
      currentDate,
      'yyyy-MM-dd'
    )}`;
    console.log('Trying Rates from Poalim: ', url);
    let currencyRates: any;
    try {
      const response = await fetch(url);
      currencyRates = await response.json();
    } catch (error) {
      console.log(error);
      return undefined;
    }

    if (currencyRates.length > 0) {
      dailyDollarRate = currencyRates.find(
        (x: any) => x.KOD_MATBEA == '19'
      ).SHAAR_YATZIG;
      dailyEuroRate = currencyRates.find(
        (x: any) => x.KOD_MATBEA == '100'
      ).SHAAR_YATZIG;
    }

    if (
      dailyDollarRate &&
      dailyEuroRate &&
      dailyDollarRate != 0 &&
      dailyEuroRate != 0
    ) {
      return {
        dollarRate: dailyDollarRate,
        euroRate: dailyEuroRate,
      };
    } else {
      return undefined;
    }
  }
}

export async function getCurrencyRates(pool: Pool) {
  let existingRatesQuery = `
      SELECT exchange_date FROM accounter_schema.exchange_rates 
      ORDER BY exchange_date DESC
      LIMIT 1
    `;
  let existingRates = await pool.query(existingRatesQuery);

  for (
    let currentDate = add(new Date(existingRates.rows[0].exchange_date), {
      days: 1,
    });
    differenceInDays(Date.now(), currentDate) >= 2;
    currentDate = add(currentDate, { days: 1 })
  ) {
    await (async () => {
      let currencyRates = await getCurrencyRatesForDate(currentDate);

      if (currencyRates) {
        let text = `
            INSERT INTO accounter_schema.exchange_rates 
            (exchange_date, usd, eur) VALUES ($1, $2, $3) RETURNING *
          `;

        let values = [
          format(currentDate, 'yyyy-MM-dd'),
          currencyRates.dollarRate,
          currencyRates.euroRate,
        ];

        try {
          let res = await pool.query(text, values);
          console.log(res.rows[0]);
        } catch (error) {
          // TODO: Log important checks
          console.log('error in insert - ', error);
          // console.log('nothing');
        }
      }
    })();
  }
}
