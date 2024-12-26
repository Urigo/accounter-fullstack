import { format } from 'date-fns';
import { XMLParser } from 'fast-xml-parser';
import Listr from 'listr';
import { Logger } from 'logger.js';
import { Pool } from 'pg';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllExchangeRatesQuery,
  IInsertExchangeRatesParams,
  IInsertExchangeRatesQuery,
  IUpdateExchangeRateParams,
  IUpdateExchangeRateQuery,
} from '../helpers/types.js';

const currencies = ['USD', 'EUR', 'GBP'] as const;
type Currency = (typeof currencies)[number];

const getAllExchangeRates = sql<IGetAllExchangeRatesQuery>`
      SELECT * FROM accounter_schema.exchange_rates 
      ORDER BY exchange_date ASC;
    `;

const insertExchangeRates = sql<IInsertExchangeRatesQuery>`
      INSERT INTO accounter_schema.exchange_rates 
      (exchange_date, usd, eur, gbp) VALUES $$newRecords(exchangeDate, usd, eur, gbp) RETURNING *;
    `;

const updateExchangeRate = sql<IUpdateExchangeRateQuery>`
  UPDATE accounter_schema.exchange_rates
  SET
  usd = COALESCE(
    $usd,
    usd
  ),
  eur = COALESCE(
    $eur,
    eur
  ),
  gbp = COALESCE(
    $gbp,
    gbp
  )
  WHERE exchange_date = $exchangeDate
  RETURNING *;
`;

const logger = new Logger();

async function getDatabaseRates(pool: Pool, ctx: Context) {
  try {
    const existingRates = await getAllExchangeRates.run(undefined, pool);

    const dbData = new Map<string, Partial<Record<Currency, number | null>>>();
    for (const rate of existingRates) {
      if (rate.exchange_date) {
        dbData.set(format(rate.exchange_date, 'yyyy-MM-dd'), {
          USD: rate.usd ? Number(rate.usd) : null,
          EUR: rate.eur ? Number(rate.eur) : null,
          GBP: rate.gbp ? Number(rate.gbp) : null,
        });
      }
    }

    ctx.databaseData = dbData;
    return dbData;
  } catch (e) {
    logger.error(e);
    throw new Error('Failed to get currency rates from DB');
  }
}

async function getBoiRates(ctx: Context) {
  try {
    const res = await fetch(
      'https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_USD_ILS,RER_EUR_ILS,RER_GBP_ILS',
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
    throw new Error('Failed to fetch currency rates from BOI');
  }
}

async function compareAndUpdateRates(pool: Pool, ctx: Context) {
  const newRecords: Array<IInsertExchangeRatesParams['newRecords'][number]> = [];

  for (const [exchangeDate, rates] of ctx.boiData!) {
    const dailyRates = ctx.databaseData!.get(exchangeDate);

    if (dailyRates) {
      // case date rates exist in DB check for changes
      const ratesValues: Omit<IUpdateExchangeRateParams, 'exchangeDate'> = {};
      for (const currency of currencies) {
        if (rates[currency] !== dailyRates[currency]) {
          if (dailyRates[currency] === null) {
            logger.log(
              `Difference in ${currency} rate for ${exchangeDate}: currently empty, updating value to ${rates[currency]}`,
            );
            ratesValues[getCurrencyKey(currency)] = rates[currency];
          } else {
            throw new Error(
              `Value of ${currency} rate on ${exchangeDate} has changed! formerly ${dailyRates[currency]}, now recorded as ${rates[currency]}. please address this manually.`,
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
            `Exchange rate updated: ${row.exchange_date ? format(row.exchange_date, 'yyyyMMdd') : 'Null date'} | USD: ${row.usd} | EUR: ${row.eur} | GBP: ${row.gbp}`,
          );
        } catch (error) {
          logger.error('Error on updating exchange rates -', error);
        }
      }
    } else if (exchangeDate > '2009-12-31') {
      // case date rates do not exist in DB, insert new record
      newRecords.push({ exchangeDate, usd: rates.USD, eur: rates.EUR, gbp: rates.GBP });
    }
  }

  if (newRecords.length) {
    try {
      const res = await insertExchangeRates.run({ newRecords }, pool);
      let newRecordsPrompt = 'New exchange rates inserted:';
      res.map(row => {
        newRecordsPrompt += `\n  ${row.exchange_date ? format(row.exchange_date, 'yyyy-MM-dd') : 'Null date'} | USD: ${row.usd} | EUR: ${row.eur} | GBP: ${row.gbp}`;
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
    case 'USD':
      return 'usd';
    case 'EUR':
      return 'eur';
    case 'GBP':
      return 'gbp';
    default:
      throw new Error(`Unsupported currency ${currency}`);
  }
}

type Context = {
  databaseData?: Awaited<ReturnType<typeof getDatabaseRates>>;
  boiData?: Awaited<ReturnType<typeof getBoiRates>>;
};

export async function getCurrencyRates(pool: Pool) {
  return new Listr<Context>([
    {
      title: 'Fetch DB Data',
      task: ctx => getDatabaseRates(pool, ctx),
    },
    {
      title: 'Fetch Bank of Israel Data',
      task: ctx => getBoiRates(ctx),
    },
    {
      title: 'Compare and Update Data',
      task: async ctx => compareAndUpdateRates(pool, ctx),
      enabled: ctx => {
        return !!ctx.databaseData && !!ctx.boiData;
      },
    },
  ]);
}
