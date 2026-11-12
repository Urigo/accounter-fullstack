import { describe, expect, it } from 'vitest';
import { getWithheldTaxParts } from '../security-withheld-tax.helper.js';

/*
 * The tax withheld on an execution, split by who withheld it. All values are made up.
 */

const execution = (foreign: string | null, israeli: string | null, capital: string | null) => ({
  foreign_tax_value_settlement_currency: foreign,
  israel_tax_value_by_payments_settlement_currency: israeli,
  capital_tax_value_settlement_currency: capital,
});

describe('getWithheldTaxParts', () => {
  it('splits the foreign tax from the Israeli tax', () => {
    expect(getWithheldTaxParts(execution('25', '5', null))).toEqual({ foreign: 25, israeli: 5 });
  });

  it('reads the capital tax column only when the Israeli one is empty', () => {
    expect(getWithheldTaxParts(execution(null, '5', '5'))).toEqual({ foreign: 0, israeli: 5 });
    expect(getWithheldTaxParts(execution(null, '0', '7'))).toEqual({ foreign: 0, israeli: 7 });
    expect(getWithheldTaxParts(execution(null, null, '7'))).toEqual({ foreign: 0, israeli: 7 });
  });

  it('keeps the sign of a refund or a cancellation', () => {
    expect(getWithheldTaxParts(execution('-25', '-5', null))).toEqual({
      foreign: -25,
      israeli: -5,
    });
  });

  it('reads nothing off empty or unreadable columns', () => {
    expect(getWithheldTaxParts(execution(null, 'n/a', null))).toEqual({ foreign: 0, israeli: 0 });
  });
});
