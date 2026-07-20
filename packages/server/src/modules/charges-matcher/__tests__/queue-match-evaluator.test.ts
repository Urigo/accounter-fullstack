import { describe, expect, it, vi } from 'vitest';
import type { ChargesMatcherProvider } from '../providers/charges-matcher.provider.js';
import { QueueMatchEvaluatorProvider } from '../providers/queue-match-evaluator.provider.js';
import type { ChargeMatchProto } from '../types.js';

type FindMatchesForChargesMock = (chargeIds: string[]) => Promise<Map<string, ChargeMatchProto[]>>;

function createProvider(findMatchesForCharges: FindMatchesForChargesMock) {
  const chargesMatcherMock = { findMatchesForCharges: vi.fn(findMatchesForCharges) };
  const provider = new QueueMatchEvaluatorProvider(
    chargesMatcherMock as unknown as ChargesMatcherProvider,
  );
  return { provider, chargesMatcherMock };
}

describe('QueueMatchEvaluatorProvider', () => {
  describe('evaluateMatchesForCharges', () => {
    it('should return one ChargeWithSuggestions per base charge, preserving input order', async () => {
      const { provider, chargesMatcherMock } = createProvider(async chargeIds => {
        return new Map(
          chargeIds.map(chargeId => [chargeId, [{ chargeId: `match-of-${chargeId}`, confidenceScore: 0.9 }]]),
        );
      });

      const baseCharges = [{ id: 'charge-1' }, { id: 'charge-2' }, { id: 'charge-3' }];
      const result = await provider.evaluateMatchesForCharges(baseCharges);

      expect(result).toHaveLength(3);
      expect(result.map(r => r.baseCharge)).toEqual(baseCharges);
      expect(result.map(r => r.id)).toEqual(['charge-1', 'charge-2', 'charge-3']);
      expect(result[0].suggestions).toEqual([
        { chargeId: 'match-of-charge-1', confidenceScore: 0.9 },
      ]);
      // The candidate pool is built once for the whole batch, not per charge
      expect(chargesMatcherMock.findMatchesForCharges).toHaveBeenCalledTimes(1);
      expect(chargesMatcherMock.findMatchesForCharges).toHaveBeenCalledWith([
        'charge-1',
        'charge-2',
        'charge-3',
      ]);
    });

    it('should sort suggestions by confidence score, highest first', async () => {
      const { provider } = createProvider(async chargeIds => {
        return new Map(
          chargeIds.map(chargeId => [
            chargeId,
            [
              { chargeId: 'low', confidenceScore: 0.31 },
              { chargeId: 'high', confidenceScore: 0.97 },
              { chargeId: 'mid', confidenceScore: 0.64 },
            ],
          ]),
        );
      });

      const [result] = await provider.evaluateMatchesForCharges([{ id: 'charge-1' }]);

      expect(result.suggestions.map(s => s.chargeId)).toEqual(['high', 'mid', 'low']);
    });

    it('should return empty suggestions for a charge missing from the matcher result', async () => {
      const { provider } = createProvider(async chargeIds => {
        // 'charge-2' failed evaluation and is absent from the map
        return new Map(
          chargeIds
            .filter(chargeId => chargeId !== 'charge-2')
            .map(chargeId => [chargeId, [{ chargeId: `match-of-${chargeId}`, confidenceScore: 0.8 }]]),
        );
      });

      const result = await provider.evaluateMatchesForCharges([
        { id: 'charge-1' },
        { id: 'charge-2' },
        { id: 'charge-3' },
      ]);

      expect(result).toHaveLength(3);
      expect(result[0].suggestions).toHaveLength(1);
      expect(result[1].suggestions).toEqual([]);
      expect(result[2].suggestions).toHaveLength(1);
    });

    it('should return an empty array for empty input without calling the matcher', async () => {
      const { provider, chargesMatcherMock } = createProvider(async () => new Map());

      const result = await provider.evaluateMatchesForCharges([]);

      expect(result).toEqual([]);
      expect(chargesMatcherMock.findMatchesForCharges).not.toHaveBeenCalled();
    });

    it('should keep base charge objects untouched (read-only evaluation)', async () => {
      const { provider } = createProvider(
        async chargeIds =>
          new Map(chargeIds.map(chargeId => [chargeId, [{ chargeId: 'match-1', confidenceScore: 0.5 }]])),
      );

      const baseCharge = { id: 'charge-1', user_description: 'original' };
      const snapshot = structuredClone(baseCharge);
      const [result] = await provider.evaluateMatchesForCharges([baseCharge]);

      expect(baseCharge).toEqual(snapshot);
      expect(result.baseCharge).toBe(baseCharge);
    });
  });
});
