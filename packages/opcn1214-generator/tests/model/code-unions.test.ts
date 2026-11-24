import { getLayout } from '../../src/layout/registry.js';
import type { RecordType } from '../../src/layout/types.js';
import {
  CAPITAL_GAINS_CODES,
  CAPITAL_GAINS_INPUT_CODES,
  CAPITAL_GAINS_SYMBOLS,
  COUNTRY_BREAKDOWN_CODES,
  COUNTRY_CODES,
  DERIVED_MAIN_CODES,
  FOREIGN_APPENDIX_CODES,
  MAIN_FORM_CODES,
  MAIN_FORM_INPUT_CODES,
  type CapitalGainsCode,
  type CapitalGainsInputCode,
  type CapitalGainsSymbol,
  type CountryBreakdownCode,
  type CountryCode,
  type DerivedMainCode,
  type ForeignAppendixCode,
  type MainFormCode,
  type MainFormInputCode,
} from '../../src/model/index.js';

const layout = getLayout(2024);
const codesOf = (type: RecordType) => layout.records[type].codes;

describe('code unions — types', () => {
  it('accepts input codes and rejects derived or foreign codes', () => {
    expectTypeOf<'010'>().toExtend<MainFormInputCode>();
    expectTypeOf<'008'>().toExtend<MainFormCode>();
    expectTypeOf<'008'>().toExtend<DerivedMainCode>();
    expectTypeOf<'008'>().not.toExtend<MainFormInputCode>();
    expectTypeOf<'420'>().toExtend<CountryBreakdownCode>();
    expectTypeOf<'401'>().toExtend<ForeignAppendixCode>();
    expectTypeOf<'401'>().not.toExtend<CountryBreakdownCode>();
    expectTypeOf<'501'>().toExtend<CapitalGainsCode<77>>();
    expectTypeOf<'501'>().not.toExtend<CapitalGainsCode<27>>();
    expectTypeOf<'501'>().not.toExtend<CapitalGainsInputCode<77>>();
    expectTypeOf<'505'>().not.toExtend<CapitalGainsInputCode<77>>();
    expectTypeOf<CapitalGainsInputCode<77>>().toEqualTypeOf<
      Exclude<CapitalGainsCode<77>, '501' | '502' | '503' | '504' | '505'>
    >();
    expectTypeOf<CapitalGainsInputCode<27>>().toEqualTypeOf<CapitalGainsCode<27>>();
    expectTypeOf<'-88'>().toExtend<CountryCode>();
    expectTypeOf<'004'>().toExtend<CountryCode>();
    expectTypeOf<'4'>().not.toExtend<CountryCode>();
    expectTypeOf<CapitalGainsSymbol>().toEqualTypeOf<
      27 | 50 | 51 | 54 | 60 | 63 | 64 | 65 | 66 | 77
    >();
  });

  it('types each runtime array exactly as its union', () => {
    expectTypeOf<(typeof MAIN_FORM_CODES)[number]>().toEqualTypeOf<MainFormCode>();
    expectTypeOf<(typeof DERIVED_MAIN_CODES)[number]>().toEqualTypeOf<DerivedMainCode>();
    expectTypeOf<(typeof MAIN_FORM_INPUT_CODES)[number]>().toEqualTypeOf<MainFormInputCode>();
    expectTypeOf<(typeof FOREIGN_APPENDIX_CODES)[number]>().toEqualTypeOf<ForeignAppendixCode>();
    expectTypeOf<(typeof COUNTRY_BREAKDOWN_CODES)[number]>().toEqualTypeOf<CountryBreakdownCode>();
    expectTypeOf<(typeof CAPITAL_GAINS_SYMBOLS)[number]>().toEqualTypeOf<CapitalGainsSymbol>();
    expectTypeOf<(typeof CAPITAL_GAINS_CODES)[27][number]>().toEqualTypeOf<CapitalGainsCode<27>>();
    expectTypeOf<(typeof CAPITAL_GAINS_CODES)[77][number]>().toEqualTypeOf<CapitalGainsCode<77>>();
    expectTypeOf<(typeof CAPITAL_GAINS_INPUT_CODES)[27][number]>().toEqualTypeOf<
      CapitalGainsInputCode<27>
    >();
    expectTypeOf<(typeof CAPITAL_GAINS_INPUT_CODES)[77][number]>().toEqualTypeOf<
      CapitalGainsInputCode<77>
    >();
    expectTypeOf<(typeof COUNTRY_CODES)[number]>().toEqualTypeOf<CountryCode>();
  });
});

describe('code unions — runtime arrays match the layout', () => {
  it('lists the 102 main-form codes, 7 of them derived and 95 input codes', () => {
    const all = codesOf('1000');
    expect(MAIN_FORM_CODES).toEqual(all.map(code => code.code));
    expect(DERIVED_MAIN_CODES).toEqual(all.filter(code => code.derived).map(code => code.code));
    expect(MAIN_FORM_INPUT_CODES).toEqual(all.filter(code => !code.derived).map(code => code.code));
    expect(MAIN_FORM_CODES).toHaveLength(102);
    expect(DERIVED_MAIN_CODES).toHaveLength(7);
    expect(MAIN_FORM_INPUT_CODES).toHaveLength(95);
  });

  it('lists the 51 foreign-appendix codes and the 23 with a per-country breakdown', () => {
    const all = codesOf('2000');
    expect(FOREIGN_APPENDIX_CODES).toEqual(all.map(code => code.code));
    expect(COUNTRY_BREAKDOWN_CODES).toEqual(
      all.filter(code => code.perCountryBreakdown).map(code => code.code),
    );
    expect(FOREIGN_APPENDIX_CODES).toHaveLength(51);
    expect(COUNTRY_BREAKDOWN_CODES).toHaveLength(23);
  });

  it('lists the codes of every capital-gains symbol', () => {
    expect(CAPITAL_GAINS_SYMBOLS).toEqual([27, 50, 51, 54, 60, 63, 64, 65, 66, 77]);
    for (const symbol of CAPITAL_GAINS_SYMBOLS) {
      const type = `30${symbol}` as const satisfies RecordType;
      expect(CAPITAL_GAINS_CODES[symbol]).toEqual(codesOf(type).map(code => code.code));
    }
    expect(Object.keys(CAPITAL_GAINS_CODES).map(Number)).toEqual([...CAPITAL_GAINS_SYMBOLS]);
  });

  it('lists the input codes of every capital-gains symbol (all but the derived 3077 501–505)', () => {
    for (const symbol of CAPITAL_GAINS_SYMBOLS) {
      const type = `30${symbol}` as const satisfies RecordType;
      expect(CAPITAL_GAINS_INPUT_CODES[symbol]).toEqual(
        codesOf(type)
          .filter(code => !code.derived)
          .map(code => code.code),
      );
    }
    expect(Object.keys(CAPITAL_GAINS_INPUT_CODES).map(Number)).toEqual([...CAPITAL_GAINS_SYMBOLS]);
    expect(CAPITAL_GAINS_CODES[77].length - CAPITAL_GAINS_INPUT_CODES[77].length).toBe(5);
  });

  it('lists the 255 country codes as keyed in the layout', () => {
    expect(COUNTRY_CODES).toEqual([...layout.countries.keys()]);
    expect(COUNTRY_CODES).toHaveLength(255);
  });
});
