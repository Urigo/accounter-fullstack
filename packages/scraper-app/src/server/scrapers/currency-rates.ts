import { format } from 'date-fns';
import { XMLParser } from 'fast-xml-parser';
import type { ServerMessage } from '../../shared/ws-protocol.js';
import type { CurrencyRatesPayload } from '../payload-schemas/currency-rates.schema.js';
import { validatePayload } from '../validate-payload.js';

const BOI_URL =
  'https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_USD_ILS,RER_EUR_ILS,RER_GBP_ILS,RER_CAD_ILS,RER_JPY_ILS,RER_AUD_ILS,RER_SEK_ILS';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'JPY', 'AUD', 'SEK'] as const;
type SupportedCurrency = (typeof CURRENCIES)[number];

export type Emitter = (msg: ServerMessage) => void;

export async function scrapeCurrencyRates(_emit: Emitter): Promise<CurrencyRatesPayload> {
  const res = await fetch(BOI_URL);
  if (!res.ok) throw new Error(`BOI fetch failed: ${res.status} ${res.statusText}`);

  const xml = await res.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    isArray: name => name === 'Series' || name === 'Obs',
    removeNSPrefix: true,
  });
  const parsed = parser.parse(xml);
  const series: unknown[] = parsed?.StructureSpecificData?.DataSet?.Series ?? [];

  if (series.length === 0) {
    return validatePayload('currency-rates', []);
  }

  const today = format(new Date(), 'yyyy-MM-dd');

  // Collect per-date, per-currency rates
  const rateMap = new Map<string, Map<SupportedCurrency, number>>();

  for (const currencyData of series) {
    const cd = currencyData as Record<string, unknown>;
    const currency = cd['@_BASE_CURRENCY'] as SupportedCurrency;
    if (!CURRENCIES.includes(currency)) continue;

    const obs: unknown[] = Array.isArray(cd['Obs']) ? (cd['Obs'] as unknown[]) : [];
    for (const entry of obs) {
      const e = entry as Record<string, string>;
      const date = e['@_TIME_PERIOD'];
      const value = Number(e['@_OBS_VALUE']);
      if (!date || Number.isNaN(value) || date === today) continue;

      const rate = currency === 'JPY' ? value * 0.01 : value;

      if (!rateMap.has(date)) rateMap.set(date, new Map());
      rateMap.get(date)!.set(currency, rate);
    }
  }

  const entries: { date: string; currency: SupportedCurrency; rate: number }[] = [];
  for (const [date, currencyRates] of rateMap) {
    for (const [currency, rate] of currencyRates) {
      entries.push({ date, currency, rate });
    }
  }

  return validatePayload('currency-rates', entries);
}
