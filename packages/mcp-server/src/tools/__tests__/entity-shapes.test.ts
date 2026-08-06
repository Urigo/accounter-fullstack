import { describe, expect, it } from 'vitest';
import {
  chargeTypeFromTypename,
} from '../entity-shapes.js';

/**
 * Unit coverage for the derived fields the detail tools expose: local-currency
 * conversion, charge classification, and document direction. These are pure
 * functions, so they are exercised directly rather than through the executor —
 * the tool-level wiring is covered in `detail-tools.test.ts`.
 */

// ---------------------------------------------------------------------------
// Charge classification
// ---------------------------------------------------------------------------

describe('chargeTypeFromTypename', () => {
  it('maps typenames onto the byChargeTypes filter vocabulary', () => {
    expect(chargeTypeFromTypename('CommonCharge')).toBe('COMMON');
    expect(chargeTypeFromTypename('SalaryCharge')).toBe('PAYROLL');
    expect(chargeTypeFromTypename('MonthlyVatCharge')).toBe('VAT');
    expect(chargeTypeFromTypename('CreditcardBankCharge')).toBe('CREDITCARD_BANK');
  });

  it('returns null for an absent or unrecognized typename', () => {
    expect(chargeTypeFromTypename(undefined)).toBeNull();
    expect(chargeTypeFromTypename('SomeFutureCharge')).toBeNull();
  });
});
