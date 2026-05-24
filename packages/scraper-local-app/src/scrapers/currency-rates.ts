import { format } from 'date-fns';
import { XMLParser } from 'fast-xml-parser';
import { Listr } from 'listr2';
import type { Pool } from 'pg';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllExchangeRatesQuery,
  IInsertExchangeRatesParams,
  IInsertExchangeRatesQuery,
  IUpdateExchangeRateParams,
  IUpdateExchangeRateQuery,
} from '../helpers/types.js';
import { MainContext } from '../index.js';
import type { Logger } from '../logger.js';

const currencies = ['AUD', 'CAD', 'EUR', 'GBP', 'JPY', 'SEK', 'UAH', 'USD'] as const;
type Currency = (typeof currencies)[number];

const getAllExchangeRates = sql<IGetAllExchangeRatesQuery>`
      SELECT * FROM accounter_schema.exchange_rates 
      ORDER BY exchange_date ASC;
    `;

const insertExchangeRates = sql<IInsertExchangeRatesQuery>`
      INSERT INTO accounter_schema.exchange_rates
      (exchange_date, aud, cad, eur, gbp, jpy, sek, uah, usd) VALUES $$newRecords(exchangeDate, aud, cad, eur, gbp, jpy, sek, uah, usd) RETURNING *;
    `;

const updateExchangeRate = sql<IUpdateExchangeRateQuery>`
  UPDATE accounter_schema.exchange_rates
  SET
  aud = COALESCE(
    $aud,
    aud
  ),
  cad = COALESCE(
    $cad,
    cad
  ),
  eur = COALESCE(
    $eur,
    eur
  ),
  gbp = COALESCE(
    $gbp,
    gbp
  ),
  jpy = COALESCE(
    $jpy,
    jpy
  ),
  sek = COALESCE(
    $sek,
    sek
  ),
  uah = COALESCE(
    $uah,
    uah
  ),
  usd = COALESCE(
    $usd,
    usd
  )
  WHERE exchange_date = $exchangeDate
  RETURNING *;
`;

async function getDatabaseRates(pool: Pool, ctx: CurrencyRatesContext, logger: Logger) {
  try {
    const existingRates = await getAllExchangeRates.run(undefined, pool);

    const dbData = new Map<string, Partial<Record<Currency, number | null>>>();
    for (const rate of existingRates) {
      if (rate.exchange_date) {
        dbData.set(format(rate.exchange_date, 'yyyy-MM-dd'), {
          AUD: rate.aud ? Number(rate.aud) : null,
          CAD: rate.cad ? Number(rate.cad) : null,
          EUR: rate.eur ? Number(rate.eur) : null,
          GBP: rate.gbp ? Number(rate.gbp) : null,
          JPY: rate.jpy ? Number(rate.jpy) : null,
          SEK: rate.sek ? Number(rate.sek) : null,
          UAH: rate.uah ? Number(rate.uah) : null,
          USD: rate.usd ? Number(rate.usd) : null,
        });
      }
    }

    ctx.databaseData = dbData;
    return dbData;
  } catch (e) {
    logger.error(e);
    throw new Error('Failed to get currency rates from DB', { cause: e });
  }
}

async function getBoiRates(ctx: CurrencyRatesContext, logger: Logger) {
  try {
    const res = await fetch(
      'https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_USD_ILS,RER_EUR_ILS,RER_GBP_ILS,RER_CAD_ILS,RER_JPY_ILS,RER_AUD_ILS,RER_SEK_ILS,RER_UAH_ILS',
    );

    const XMLdata = await res.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
    });
    const parsedXml = parser.parse(XMLdata);

    if (!parsedXml?.['message:StructureSpecificData']?.['message:DataSet']?.Series?.length) {
      throw new Error('No data found in BOI response');
    }

    const boiData = new Map<string, Partial<Record<Currency, number | null>>>();
    const series = parsedXml['message:StructureSpecificData']['message:DataSet']['Series'];
    for (const currencyData of series) {
      if (currencyData.Obs?.length) {
        const currency = currencyData['@_BASE_CURRENCY'] as Currency;
        if (!currencies.includes(currency)) {
          throw new Error(`Unsupported BOI currency ${currency}`);
        }
        for (const obs of currencyData.Obs) {
          if (boiData.has(obs['@_TIME_PERIOD'])) {
            boiData.set(obs['@_TIME_PERIOD'], {
              ...boiData.get(obs['@_TIME_PERIOD']),
              [currency]: Number(obs['@_OBS_VALUE']),
            });
          } else {
            boiData.set(obs['@_TIME_PERIOD'], {
              [currency]: Number(obs['@_OBS_VALUE']),
            });
          }
        }
      }
    }

    // remove today's rates as they might update until the end of the day
    boiData.delete(format(new Date(), 'yyyy-MM-dd'));

    ctx.boiData = boiData;
    return boiData;
  } catch (e) {
    logger.error(e);
    throw new Error('Failed to fetch currency rates from BOI', { cause: e });
  }
}

async function compareAndUpdateRates(pool: Pool, ctx: CurrencyRatesContext, logger: Logger) {
  const newRecords: Array<IInsertExchangeRatesParams['newRecords'][number]> = [];

  for (const [exchangeDate, rates] of ctx.boiData!) {
    const dailyRates = ctx.databaseData!.get(exchangeDate);

    if (dailyRates) {
      // case date rates exist in DB check for changes
      const ratesValues: Omit<IUpdateExchangeRateParams, 'exchangeDate'> = {};
      for (const currency of currencies) {
        let rateMultiplier = 1;
        if (currency === 'JPY') {
          rateMultiplier = 0.01; // JPY rate from source is for 100 units, convert to rate for 1 unit
        }
        const newRate =
          rates[currency] == null ? null : Number((rates[currency] * rateMultiplier).toFixed(6));
        if (newRate !== dailyRates[currency]) {
          if (dailyRates[currency] === null) {
            logger.log(
              `Difference in ${currency} rate for ${exchangeDate}: currently empty, updating value to ${newRate}`,
            );
            ratesValues[getCurrencyKey(currency)] = newRate;
          } else {
            throw new Error(
              `Value of ${currency} rate on ${exchangeDate} has changed! formerly ${dailyRates[currency]}, now recorded as ${newRate}. please address this manually.`,
            );
          }
        }
      }

      if (Object.keys(ratesValues).length) {
        try {
          const [row] = await updateExchangeRate.run(
            {
              exchangeDate,
              ...ratesValues,
            },
            pool,
          );
          logger.log(
            `Exchange rate updated: ${row.exchange_date ? format(row.exchange_date, 'yyyyMMdd') : 'Null date'} | AUD: ${row.aud} | CAD: ${row.cad} | EUR: ${row.eur} | GBP: ${row.gbp} | JPY: ${row.jpy} | SEK: ${row.sek} | UAH: ${row.uah} | USD: ${row.usd}`,
          );
        } catch (error) {
          logger.error('Error on updating exchange rates -', error);
        }
      }
    } else if (exchangeDate > '2009-12-31') {
      // case date rates do not exist in DB, insert new record
      newRecords.push({
        exchangeDate,
        aud: rates.AUD,
        cad: rates.CAD,
        eur: rates.EUR,
        gbp: rates.GBP,
        jpy: rates.JPY == null ? undefined : rates.JPY * 0.01, // JPY rate from source is for 100 units, convert to rate for 1 unit
        sek: rates.SEK,
        uah: rates.UAH,
        usd: rates.USD,
      });
    }
  }

  if (newRecords.length) {
    try {
      const res = await insertExchangeRates.run({ newRecords }, pool);
      let newRecordsPrompt = 'New exchange rates inserted:';
      res.map(row => {
        newRecordsPrompt += `\n  ${row.exchange_date ? format(row.exchange_date, 'yyyy-MM-dd') : 'Null date'} | AUD: ${row.aud} | CAD: ${row.cad} | EUR: ${row.eur} | GBP: ${row.gbp} | JPY: ${row.jpy} | SEK: ${row.sek} | UAH: ${row.uah} | USD: ${row.usd}`;
      });
      logger.log(newRecordsPrompt);
    } catch (error) {
      logger.error('Error on inserting exchange rates - ', error);
    }
  }

  return;
}

function getCurrencyKey(currency: Currency): keyof Omit<IUpdateExchangeRateParams, 'exchangeDate'> {
  switch (currency) {
    case 'AUD':
      return 'aud';
    case 'CAD':
      return 'cad';
    case 'EUR':
      return 'eur';
    case 'GBP':
      return 'gbp';
    case 'JPY':
      return 'jpy';
    case 'SEK':
      return 'sek';
    case 'UAH':
      return 'uah';
    case 'USD':
      return 'usd';
    default:
      throw new Error(`Unsupported currency ${currency}`);
  }
}

type CurrencyRatesContext = {
  databaseData?: Awaited<ReturnType<typeof getDatabaseRates>>;
  boiData?: Awaited<ReturnType<typeof getBoiRates>>;
};

const KEY = 'currencyRates';

export async function getCurrencyRates(ctx: MainContext & { [KEY]?: CurrencyRatesContext }) {
  ctx[KEY] ??= {};
  return new Listr<MainContext & { [KEY]: CurrencyRatesContext }>([
    {
      title: 'Fetch DB Data',
      task: ctx => getDatabaseRates(ctx.pool, ctx[KEY], ctx.logger),
    },
    {
      title: 'Fetch Bank of Israel Data',
      task: ctx => getBoiRates(ctx[KEY], ctx.logger),
    },
    {
      title: 'Compare and Update Data',
      task: async ctx => compareAndUpdateRates(ctx.pool, ctx[KEY], ctx.logger),
      enabled: ctx => {
        return !!ctx[KEY].databaseData && !!ctx[KEY].boiData;
      },
    },
  ]);
}
