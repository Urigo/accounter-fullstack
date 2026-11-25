import { parseValues } from '../../scripts/layout/values.js';

describe('parseValues', () => {
  it('parses labelled items', () => {
    expect(parseValues('1=yes;2=no')).toEqual([
      { value: 1, label: 'yes' },
      { value: 2, label: 'no' },
    ]);
  });

  it('expands an inclusive range', () => {
    const values = parseValues('1..12');
    expect(values).toHaveLength(12);
    expect(values?.[0]).toEqual({ value: 1 });
    expect(values?.[11]).toEqual({ value: 12 });
  });

  it('parses plain numbers', () => {
    expect(parseValues('5;8;10;15;115;20')).toEqual([
      { value: 5 },
      { value: 8 },
      { value: 10 },
      { value: 15 },
      { value: 115 },
      { value: 20 },
    ]);
  });

  it('parses nine-digit special values', () => {
    expect(
      parseValues(
        '999999964=individual/corporation not registered in Israel;999999998=public shareholding',
      ),
    ).toEqual([
      { value: 999_999_964, label: 'individual/corporation not registered in Israel' },
      { value: 999_999_998, label: 'public shareholding' },
    ]);
  });

  it('splits each item on the first "=" only (1000@834)', () => {
    expect(
      parseValues(
        '1=turnover above threshold, must file 6111 (code 297=8);2=not obliged (code 297=9);3=not relevant',
      ),
    ).toEqual([
      { value: 1, label: 'turnover above threshold, must file 6111 (code 297=8)' },
      { value: 2, label: 'not obliged (code 297=9)' },
      { value: 3, label: 'not relevant' },
    ]);
  });

  it('mixes items of every form', () => {
    expect(parseValues('0;3..4;9=other')).toEqual([
      { value: 0 },
      { value: 3 },
      { value: 4 },
      { value: 9, label: 'other' },
    ]);
  });

  it('returns undefined for an empty cell', () => {
    expect(parseValues('')).toBeUndefined();
  });

  it.each([
    ['1;;2'],
    [';1'],
    ['1;'],
    ['a'],
    ['1.5'],
    ['-1'],
    ['3..1'],
    ['1..'],
    ['..2'],
    ['1='],
    ['=label'],
  ])('throws on malformed input %j', text => {
    expect(() => parseValues(text)).toThrow();
  });
});
