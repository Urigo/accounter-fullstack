import type { TimelessDateString } from '../../../shared/types/index.js';
import type { CbsPriceIndexEntry } from '../../app-providers/cbs-price-index-client.js';
import {
  addMonths,
  defaultPublicationDate,
  yearMonthToPeriod,
  type PriceIndexBase,
  type PriceIndexRow,
} from './price-index.helper.js';

type ChainLink = { chainCoefficient: number | null; chainedFactor: number };

/** Today's date in Israel, where CBS publishes */
export function todayInIsrael(now: Date): TimelessDateString {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now) as TimelessDateString;
}

/**
 * Derives every base's chain coefficient and cumulative factor from an entry fetched with
 * `coef=true`. The oldest base in the chain gets factor 1, so chained values are expressed in it.
 */
export function computeChainFactors(entry: CbsPriceIndexEntry): Map<string, ChainLink> {
  // newest → oldest; previousBases[i].coefficient links labels[i] to labels[i + 1]
  const labels = [entry.baseLabel, ...entry.previousBases.map(base => base.baseLabel)];
  const coefficients = entry.previousBases.map(base => base.coefficient);
  const links = new Map<string, ChainLink>();
  let factor = 1;
  for (let i = labels.length - 1; i >= 0; i--) {
    const chainCoefficient = i < coefficients.length ? coefficients[i] : null;
    if (chainCoefficient != null) {
      factor *= chainCoefficient;
    }
    links.set(labels[i], { chainCoefficient, chainedFactor: factor });
  }
  return links;
}

/**
 * Incremental runs can skip calling CBS until the next month's index could plausibly be out:
 * month M is published around the 15th of M+1 (earlier when the 15th is a weekend or holiday).
 */
export function isNextIndexDue(latestPeriod: TimelessDateString, today: TimelessDateString) {
  const nextPeriod = addMonths(latestPeriod, 1);
  const earliestPublication = `${addMonths(nextPeriod, 1).slice(0, 7)}-10`;
  return today >= earliestPublication;
}

/**
 * Turns fetched CBS entries into the bases and value rows to upsert.
 *
 * @param chains - chain factors from an entry fetched with coefficients, covering every base the entries use
 * @param knownBases - bases already stored, used when `chains` doesn't cover an entry's base
 * @param today - publication of a month first seen before its default date is recorded as today
 */
export function buildSyncRows(params: {
  indexCode: number;
  entries: CbsPriceIndexEntry[];
  chains: Map<string, ChainLink>;
  knownBases: PriceIndexBase[];
  today: TimelessDateString;
}): { bases: PriceIndexBase[]; values: PriceIndexRow[] } {
  const { indexCode, entries, chains, knownBases, today } = params;
  const knownByLabel = new Map(knownBases.map(base => [base.baseLabel, base]));

  const bases = new Map<string, PriceIndexBase>();
  const values: PriceIndexRow[] = [];

  for (const entry of entries) {
    if (entry.indexCode !== indexCode) {
      continue;
    }
    const period = yearMonthToPeriod(entry.year, entry.month);
    const link = chains.get(entry.baseLabel) ?? knownByLabel.get(entry.baseLabel);
    if (!link) {
      throw new Error(
        `Missing chain coefficient for base "${entry.baseLabel}" of price index ${indexCode}`,
      );
    }

    const existing = bases.get(entry.baseLabel);
    const knownFirstPeriod = knownByLabel.get(entry.baseLabel)?.firstPeriod;
    const firstPeriod = [existing?.firstPeriod, knownFirstPeriod, period]
      .filter((candidate): candidate is TimelessDateString => !!candidate)
      .sort()[0];
    bases.set(entry.baseLabel, {
      baseLabel: entry.baseLabel,
      firstPeriod,
      chainCoefficient: link.chainCoefficient,
      chainedFactor: link.chainedFactor,
    });

    const defaultPublishedOn = defaultPublicationDate(period);
    values.push({
      indexCode,
      period,
      value: entry.value,
      baseLabel: entry.baseLabel,
      chainedValue: entry.value * link.chainedFactor,
      monthlyChangePct: entry.monthlyChangePct,
      yearlyChangePct: entry.yearlyChangePct,
      publishedOn: today < defaultPublishedOn ? today : defaultPublishedOn,
    });
  }

  return { bases: Array.from(bases.values()), values };
}
