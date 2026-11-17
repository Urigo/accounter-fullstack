import { getLayout } from '../../src/layout/registry.js';
import {
  CONSOLIDATED_REPORT_CODES,
  ENUM_INPUTS,
  enumCode,
  enumLiteral,
  FORM_6111_OBLIGATION_CODES,
  RELATION_TYPE_CODES,
} from '../../src/normalize/enums.js';

const MAIN = getLayout(2024).records['1000'];
const RELATED = getLayout(2024).records['1010'];
const byValue = (a: number, b: number) => a - b;

describe('enum literal ↔ code maps (SPEC §7.2)', () => {
  it('form6111Obligation: obliged/notObliged/notRelevant → 1/2/3', () => {
    expect(FORM_6111_OBLIGATION_CODES).toEqual({ obliged: 1, notObliged: 2, notRelevant: 3 });
  });

  it('consolidatedReport → 1/2/3', () => {
    expect(CONSOLIDATED_REPORT_CODES).toEqual({
      consolidatedUnderSection23: 1,
      consolidatesWithParent: 2,
      notRelevant: 3,
    });
  });

  it('relationType: parent … other → 1..8 (SPEC §7.2)', () => {
    expect(RELATION_TYPE_CODES).toEqual({
      parent: 1,
      subsidiary: 2,
      partnership: 3,
      kibbutzRelatedCorporation: 4,
      jointlyControlled: 5,
      granddaughter: 6,
      grandmother: 7,
      other: 8,
    });
  });

  it('relationType maps exactly the allowed values of 1010@198', () => {
    const field = RELATED.fields.find(candidate => candidate.key === 'relationType');
    expect(field?.kind).toBe('enum');
    expect(Object.values(RELATION_TYPE_CODES).sort(byValue)).toEqual(
      field?.values?.map(value => value.value).sort(byValue),
    );
  });

  it.each(Object.entries(ENUM_INPUTS))(
    '%s maps exactly the allowed values of its field',
    (key, codes) => {
      const field = MAIN.fields.find(candidate => candidate.key === key);
      expect(field?.kind).toBe('enum');
      expect(Object.values(codes ?? {}).sort(byValue)).toEqual(
        field?.values?.map(value => value.value).sort(byValue),
      );
    },
  );

  it('enumCode maps a literal and keeps anything else as-is (field.enum reports it)', () => {
    expect(enumCode(FORM_6111_OBLIGATION_CODES, 'notObliged')).toBe(2);
    expect(enumCode(FORM_6111_OBLIGATION_CODES, undefined)).toBeUndefined();
    expect(enumCode(FORM_6111_OBLIGATION_CODES, 'toString')).toBe('toString');
    expect(enumCode(FORM_6111_OBLIGATION_CODES, 4)).toBe(4);
  });

  it('enumLiteral is the inverse of enumCode and keeps an unknown code as-is', () => {
    for (const [literal, code] of Object.entries(CONSOLIDATED_REPORT_CODES)) {
      expect(enumLiteral(CONSOLIDATED_REPORT_CODES, code)).toBe(literal);
    }
    expect(enumLiteral(CONSOLIDATED_REPORT_CODES, 7)).toBe(7);
    expect(enumLiteral(CONSOLIDATED_REPORT_CODES, undefined)).toBeUndefined();
  });
});
