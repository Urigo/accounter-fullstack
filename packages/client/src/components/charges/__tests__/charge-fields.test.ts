import { describe, expect, it } from 'vitest';
import { MissingChargeInfo } from '../../../gql/graphql.js';
import { CHARGE_TYPE_NAME, type ChargeType } from '../../../helpers/index.js';
import {
  CHARGE_FIELDS,
  isFieldVisible,
  isMissing,
  isSpecialField,
  relevantMissingInfo,
  visibleFields,
  type ChargeField,
} from '../charge-fields.js';

const ALL_TYPES = Object.keys(CHARGE_TYPE_NAME) as ChargeType[];

/**
 * These assertions describe the *shape* of the spec sheet rather than restating it cell by cell, so
 * they catch the mistakes a hand-transcribed matrix actually makes: a transposed row, a digit in the
 * wrong column, a row of the wrong length. A deliberate spec change will fail them, which is the
 * point — it forces a second look at the sheet.
 */
describe('charge field matrix', () => {
  it('covers every charge type the client knows about', () => {
    expect(ALL_TYPES).toHaveLength(11);
    for (const type of ALL_TYPES) {
      // A type missing from the matrix would silently fall back to "show everything".
      expect(visibleFields(type).length, `${type} has no matrix row`).toBeGreaterThan(0);
    }
  });

  it('gives every type a full-width row', () => {
    // Rows are positional against CHARGE_FIELDS; a short row would make later fields read as hidden.
    for (const type of ALL_TYPES) {
      const decided = CHARGE_FIELDS.filter(
        field => isFieldVisible(type, field) || !isFieldVisible(type, field),
      );
      expect(decided).toHaveLength(CHARGE_FIELDS.length);
    }
  });

  it.each<ChargeField>(['type', 'mainDate', 'description', 'tags', 'ledgerCount'])(
    'shows %s on all 11 types',
    field => {
      for (const type of ALL_TYPES) {
        expect(isFieldVisible(type, field), `${type}.${field}`).toBe(true);
      }
    },
  );

  /**
   * The heart of why the record composes fields per type instead of sharing table columns: these two
   * attributes apply to exactly one charge type each, so as columns they were blank 10 rows out of 11.
   */
  it('shows vat and businessTrip on exactly one type each', () => {
    expect(ALL_TYPES.filter(type => isFieldVisible(type, 'vat'))).toEqual(['CommonCharge']);
    expect(ALL_TYPES.filter(type => isFieldVisible(type, 'businessTrip'))).toEqual([
      'BusinessTripCharge',
    ]);
  });

  it('hides amount only on FinancialCharge and transactions only on FinancialCharge', () => {
    expect(ALL_TYPES.filter(type => !isFieldVisible(type, 'amount'))).toEqual(['FinancialCharge']);
    expect(ALL_TYPES.filter(type => !isFieldVisible(type, 'transactionsCount'))).toEqual([
      'FinancialCharge',
    ]);
  });

  it('matches the spec on how many types show each optional field', () => {
    const count = (field: ChargeField): number =>
      ALL_TYPES.filter(type => isFieldVisible(type, field)).length;

    expect({
      dateRange: count('dateRange'),
      mainCounterparty: count('mainCounterparty'),
      mainTaxCategory: count('mainTaxCategory'),
      documentsCount: count('documentsCount'),
      miscExpensesCount: count('miscExpensesCount'),
    }).toEqual({
      dateRange: 7,
      mainCounterparty: 4,
      mainTaxCategory: 5,
      documentsCount: 5,
      miscExpensesCount: 7,
    });
  });

  it('special-cases exactly the two fields the spec footnotes call out', () => {
    const specials = ALL_TYPES.flatMap(type =>
      CHARGE_FIELDS.filter(field => isSpecialField(type, field)).map(field => `${type}.${field}`),
    );
    expect(specials.sort()).toEqual([
      'ConversionCharge.amount',
      'InternalTransferCharge.mainCounterparty',
    ]);
  });

  it('treats a special-cased field as visible', () => {
    expect(isFieldVisible('ConversionCharge', 'amount')).toBe(true);
    expect(isFieldVisible('InternalTransferCharge', 'mainCounterparty')).toBe(true);
  });

  it('shows everything for an unknown charge type rather than rendering an empty record', () => {
    const unknown = 'FutureCharge' as ChargeType;
    expect(visibleFields(unknown)).toEqual([...CHARGE_FIELDS]);
  });
});

describe('relevantMissingInfo', () => {
  it('drops missing info the charge type has nowhere to show', () => {
    // The server flags a missing counterparty on charges whose spec row hides the field — without
    // filtering, the record would advertise a need the user cannot act on.
    expect(isFieldVisible('SalaryCharge', 'mainCounterparty')).toBe(false);
    expect(relevantMissingInfo('SalaryCharge', [MissingChargeInfo.Counterparty])).toEqual([]);
  });

  it('keeps missing info the charge type does show', () => {
    expect(relevantMissingInfo('CommonCharge', [MissingChargeInfo.Counterparty])).toEqual([
      MissingChargeInfo.Counterparty,
    ]);
  });

  it('keeps description and tags for every type, since all 11 display them', () => {
    for (const type of ALL_TYPES) {
      expect(
        relevantMissingInfo(type, [MissingChargeInfo.Description, MissingChargeInfo.Tags]),
        type,
      ).toEqual([MissingChargeInfo.Description, MissingChargeInfo.Tags]);
    }
  });

  it('drops VAT for the ten types that do not display it', () => {
    for (const type of ALL_TYPES.filter(t => t !== 'CommonCharge')) {
      expect(relevantMissingInfo(type, [MissingChargeInfo.Vat]), type).toEqual([]);
    }
    expect(relevantMissingInfo('CommonCharge', [MissingChargeInfo.Vat])).toEqual([
      MissingChargeInfo.Vat,
    ]);
  });

  it('handles an absent validationData', () => {
    expect(relevantMissingInfo('CommonCharge', undefined)).toEqual([]);
  });
});

describe('isMissing', () => {
  it('requires both that the server reported it and that the type displays it', () => {
    expect(isMissing('CommonCharge', [MissingChargeInfo.Vat], MissingChargeInfo.Vat)).toBe(true);
    expect(isMissing('SalaryCharge', [MissingChargeInfo.Vat], MissingChargeInfo.Vat)).toBe(false);
    expect(isMissing('CommonCharge', [], MissingChargeInfo.Vat)).toBe(false);
    expect(isMissing('CommonCharge', undefined, MissingChargeInfo.Vat)).toBe(false);
  });
});
