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

const CHAIN_FACTOR_TOLERANCE = 1e-9;

/**
 * Fails when freshly fetched chain factors disagree with stored ones. Factors are anchored at the
 * oldest base CBS returns, so a shorter or re-anchored chain would put new chained values on a
 * different scale than stored rows and silently break cross-period linkage.
 */
export function assertChainsMatchKnownBases(
  chains: Map<string, ChainLink>,
  knownBases: PriceIndexBase[],
  indexCode: number,
) {
  for (const known of knownBases) {
    const fetched = chains.get(known.baseLabel);
    if (!fetched) {
      continue;
    }
    const relativeDiff =
      Math.abs(fetched.chainedFactor - known.chainedFactor) / Math.abs(known.chainedFactor);
    if (relativeDiff > CHAIN_FACTOR_TOLERANCE) {
      throw new Error(
        `Chain factor of base "${known.baseLabel}" of price index ${indexCode} changed: stored ${known.chainedFactor}, fetched ${fetched.chainedFactor}`,
      );
    }
  }
}

/**
 * Turns fetched CBS entries into the bases and value rows to upsert.
 *
 * Publication dates: CBS exposes none, so a new month gets the 15th of the following month (the
 * CBS calculator's own rule), or `today` when the sync first sees it earlier. Only an early
 * publication caught by a run on that same day is therefore recorded exactly; after downtime, and
 * for backfilled history, an early publication still reads as the 15th, which can shift the
 * "known" index by a day or two around month boundaries. `published_on` can be corrected by hand;
 * syncs never overwrite it.
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
