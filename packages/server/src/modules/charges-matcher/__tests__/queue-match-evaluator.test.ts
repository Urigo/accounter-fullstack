import { describe, expect, it, vi } from 'vitest';
import type { ChargesMatcherProvider } from '../providers/charges-matcher.provider.js';
import {
  MATCH_EVALUATION_CONCURRENCY,
  QueueMatchEvaluatorProvider,
} from '../providers/queue-match-evaluator.provider.js';
import type { ChargeMatchesResult } from '../types.js';

type FindMatchesMock = (chargeId: string) => Promise<ChargeMatchesResult>;

function createProvider(findMatchesForCharge: FindMatchesMock) {
  const chargesMatcherMock = { findMatchesForCharge: vi.fn(findMatchesForCharge) };
  const provider = new QueueMatchEvaluatorProvider(
    chargesMatcherMock as unknown as ChargesMatcherProvider,
  );
  return { provider, chargesMatcherMock };
}

describe('QueueMatchEvaluatorProvider', () => {
  describe('evaluateMatchesForCharges', () => {
    it('should return one ChargeWithSuggestions per base charge, preserving input order', async () => {
      const { provider, chargesMatcherMock } = createProvider(async chargeId => ({
        matches: [{ chargeId: `match-of-${chargeId}`, confidenceScore: 0.9 }],
      }));

      const baseCharges = [{ id: 'charge-1' }, { id: 'charge-2' }, { id: 'charge-3' }];
      const result = await provider.evaluateMatchesForCharges(baseCharges);

      expect(result).toHaveLength(3);
      expect(result.map(r => r.baseCharge)).toEqual(baseCharges);
      expect(result[0].suggestions).toEqual([
        { chargeId: 'match-of-charge-1', confidenceScore: 0.9 },
      ]);
      expect(chargesMatcherMock.findMatchesForCharge).toHaveBeenCalledTimes(3);
      expect(chargesMatcherMock.findMatchesForCharge).toHaveBeenCalledWith('charge-1');
      expect(chargesMatcherMock.findMatchesForCharge).toHaveBeenCalledWith('charge-2');
      expect(chargesMatcherMock.findMatchesForCharge).toHaveBeenCalledWith('charge-3');
    });

    it('should sort suggestions by confidence score, highest first', async () => {
      const { provider } = createProvider(async () => ({
        matches: [
          { chargeId: 'low', confidenceScore: 0.31 },
          { chargeId: 'high', confidenceScore: 0.97 },
          { chargeId: 'mid', confidenceScore: 0.64 },
        ],
      }));

      const [result] = await provider.evaluateMatchesForCharges([{ id: 'charge-1' }]);

      expect(result.suggestions.map(s => s.chargeId)).toEqual(['high', 'mid', 'low']);
    });

    it('should return empty suggestions for a charge whose evaluation fails, without failing the batch', async () => {
      const { provider } = createProvider(async chargeId => {
        if (chargeId === 'charge-2') {
          throw new Error('Charge is already matched');
        }
        return { matches: [{ chargeId: `match-of-${chargeId}`, confidenceScore: 0.8 }] };
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
      const { provider, chargesMatcherMock } = createProvider(async () => ({ matches: [] }));

      const result = await provider.evaluateMatchesForCharges([]);

      expect(result).toEqual([]);
      expect(chargesMatcherMock.findMatchesForCharge).not.toHaveBeenCalled();
    });

    it('should evaluate charges with bounded concurrency', async () => {
      let inFlight = 0;
      let maxInFlight = 0;
      const { provider } = createProvider(async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise(resolve => setTimeout(resolve, 5));
        inFlight--;
        return { matches: [] };
      });

      const baseCharges = Array.from({ length: MATCH_EVALUATION_CONCURRENCY * 3 }, (_, i) => ({
        id: `charge-${i}`,
      }));
      const result = await provider.evaluateMatchesForCharges(baseCharges);

      expect(result).toHaveLength(baseCharges.length);
      expect(maxInFlight).toBeGreaterThan(0);
      expect(maxInFlight).toBeLessThanOrEqual(MATCH_EVALUATION_CONCURRENCY);
    });

    it('should keep base charge objects untouched (read-only evaluation)', async () => {
      const { provider } = createProvider(async () => ({
        matches: [{ chargeId: 'match-1', confidenceScore: 0.5 }],
      }));

      const baseCharge = { id: 'charge-1', user_description: 'original' };
      const snapshot = structuredClone(baseCharge);
      const [result] = await provider.evaluateMatchesForCharges([baseCharge]);

      expect(baseCharge).toEqual(snapshot);
      expect(result.baseCharge).toBe(baseCharge);
    });
  });
});
