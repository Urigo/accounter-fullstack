/**
 * Queue Match Evaluator Provider
 *
 * Lazily evaluates match suggestions for a batch of unmatched charges, powering
 * the charge matching review screen queue. Purely read-only and analytical —
 * no DB mutations happen here.
 */

import { Injectable, Scope } from 'graphql-modules';
import type { ChargeMatchProto } from '../types.js';
import { ChargesMatcherProvider } from './charges-matcher.provider.js';

/**
 * Max number of charges scored in parallel. Each scoring pass loads candidate
 * charges, transactions and documents, so an unbounded burst would exhaust the
 * DB connection pool while a strictly sequential run would be needlessly slow.
 */
export const MATCH_EVALUATION_CONCURRENCY = 5;

/**
 * A base charge paired with its match suggestions, ordered by confidence score
 * (highest first)
 */
export interface ChargeWithSuggestionsProto<TCharge = { id: string }> {
  baseCharge: TCharge;
  suggestions: ChargeMatchProto[];
}

@Injectable({
  scope: Scope.Operation,
})
export class QueueMatchEvaluatorProvider {
  constructor(private chargesMatcherProvider: ChargesMatcherProvider) {}

  /**
   * Calculate match suggestions for a batch of unmatched charges on the fly.
   *
   * Reuses the existing per-charge matching algorithm, running it with bounded
   * concurrency. A charge whose evaluation fails (e.g. it turns out to be
   * already matched) is returned with empty suggestions rather than failing
   * the whole batch.
   *
   * @param baseCharges - Unmatched charges to evaluate, in queue order
   * @returns One entry per input charge, preserving input order
   */
  async evaluateMatchesForCharges<TCharge extends { id: string }>(
    baseCharges: TCharge[],
  ): Promise<ChargeWithSuggestionsProto<TCharge>[]> {
    const results = new Array<ChargeWithSuggestionsProto<TCharge>>(baseCharges.length);

    let nextIndex = 0;
    const worker = async (): Promise<void> => {
      while (nextIndex < baseCharges.length) {
        const index = nextIndex++;
        const baseCharge = baseCharges[index];
        results[index] = {
          baseCharge,
          suggestions: await this.evaluateSingleCharge(baseCharge.id),
        };
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(MATCH_EVALUATION_CONCURRENCY, baseCharges.length) }, () =>
        worker(),
      ),
    );

    return results;
  }

  private async evaluateSingleCharge(chargeId: string): Promise<ChargeMatchProto[]> {
    try {
      const { matches } = await this.chargesMatcherProvider.findMatchesForCharge(chargeId);
      // findMatchesForCharge returns a fresh array, so sorting in place is safe
      return matches.sort((a, b) => b.confidenceScore - a.confidenceScore);
    } catch (error) {
      // Evaluation is best-effort: a charge that can't be scored (already
      // matched, missing data, etc.) still shows up in the queue, just with
      // no suggestions.
      console.error(`Failed to evaluate matches for charge ${chargeId}:`, error);
      return [];
    }
  }
}
