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
 * A base charge paired with its match suggestions, ordered by confidence score
 * (highest first)
 */
export interface ChargeWithSuggestionsProto<TCharge = { id: string }> {
  id: string;
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
   * Delegates to `ChargesMatcherProvider.findMatchesForCharges`, which builds the
   * candidate pool once for the whole batch (instead of once per charge). A charge
   * whose evaluation fails (e.g. it turns out to be already matched) is returned
   * with empty suggestions rather than failing the whole batch.
   *
   * @param baseCharges - Unmatched charges to evaluate, in queue order
   * @returns One entry per input charge, preserving input order
   */
  async evaluateMatchesForCharges<TCharge extends { id: string }>(
    baseCharges: TCharge[],
  ): Promise<ChargeWithSuggestionsProto<TCharge>[]> {
    if (baseCharges.length === 0) {
      return [];
    }

    const matchesByChargeId = await this.chargesMatcherProvider.findMatchesForCharges(
      baseCharges.map(baseCharge => baseCharge.id),
    );

    return baseCharges.map(baseCharge => ({
      id: baseCharge.id,
      baseCharge,
      // Copy before sorting so we never mutate an array owned by another provider
      suggestions: [...(matchesByChargeId.get(baseCharge.id) ?? [])].sort(
        (a, b) => b.confidenceScore - a.confidenceScore,
      ),
    }));
  }
}
