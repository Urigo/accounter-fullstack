/**
 * Queue Match Evaluator Provider
 *
 * Lazily evaluates match suggestions for a batch of unmatched charges, powering
 * the charge matching review screen queue. Purely read-only and analytical —
 * no DB mutations happen here.
 */

import DataLoader from 'dataloader';
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

  /**
   * DataLoader for lazily resolving a single charge's match suggestions.
   *
   * Backs the `ChargeWithSuggestions.suggestions` field resolver so the queue can
   * return base charges immediately and stream suggestions in via `@defer`. All
   * suggestions requested within the operation are coalesced into a single
   * `findMatchesForCharges` call, so the shared candidate pool is still built once.
   */
  public suggestionsByChargeIdLoader = new DataLoader<string, ChargeMatchProto[], string>(
    chargeIds => this.batchLoadSuggestions(chargeIds),
    { name: 'suggestionsByChargeIdLoader' },
  );

  private async batchLoadSuggestions(
    chargeIds: readonly string[],
  ): Promise<ChargeMatchProto[][]> {
    const matchesByChargeId = await this.chargesMatcherProvider.findMatchesForCharges([
      ...chargeIds,
    ]);
    return chargeIds.map(chargeId =>
      // Copy before sorting so we never mutate an array owned by another provider
      [...(matchesByChargeId.get(chargeId) ?? [])].sort(
        (a, b) => b.confidenceScore - a.confidenceScore,
      ),
    );
  }
}
