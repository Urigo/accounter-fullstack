import type { PhonePrefix, Report1214Input } from '../../src/index.js';
import { canonicalize } from '../../src/normalize/canonical.js';
import { minimalInput } from '../fixtures/builders.js';

const TODAY = '2025-03-31';
const OPTIONS = { today: () => TODAY };

describe('canonicalize', () => {
  it('adds the written meta values to an otherwise canonical input', () => {
    expect(canonicalize(minimalInput(), OPTIONS)).toEqual({
      ...minimalInput(),
      meta: { softwareName: 'ACCOUNTER', saveDate: TODAY },
    });
  });

  it('keeps the given meta values (text normalized) and calls today only without a save date', () => {
    const today = vi.fn(() => TODAY);
    const input = minimalInput({
      meta: { softwareName: '  My\u00A0 Soft ', saveDate: '2025-01-02' },
    });
    expect(canonicalize(input, { today }).meta).toEqual({
      softwareName: 'My Soft',
      saveDate: '2025-01-02',
    });
    expect(today).not.toHaveBeenCalled();
  });

  it.each(['', '   ', '\u00A0'])(
    'writes the default software name for a name that normalizes to %j',
    softwareName => {
      expect(canonicalize(minimalInput({ meta: { softwareName } }), OPTIONS).meta).toEqual({
        softwareName: 'ACCOUNTER',
        saveDate: TODAY,
      });
    },
  );

  it('keeps ×100 values in hundredths, without float residue', () => {
    const shareholder = {
      idNumber: '123456782',
      fullName: 'ישראל ישראלי',
      isControllingShareholder: true,
      dividendRightsPercent: 0.1 + 0.2,
      votingRightsPercent: 1.1 + 2.2,
      otherRightsPercent: 100,
    };
    const [result] = canonicalize(
      minimalInput({ shareholders: [shareholder] }),
      OPTIONS,
    ).shareholders;
    expect(result).toMatchObject({
      dividendRightsPercent: 0.3,
      votingRightsPercent: 3.3,
      otherRightsPercent: 100,
    });
  });

  it('normalizes text and removes empty optional text', () => {
    const { company } = canonicalize(
      minimalInput({
        company: {
          registeredName: '  חברה\u00A0\u00A0לדוגמה \u2013 בע\u201Dמ ',
          occupationDescription: '   ',
          email: '',
        },
      }),
      OPTIONS,
    );
    expect(company.registeredName).toBe('חברה לדוגמה - בע"מ');
    expect(company).not.toHaveProperty('occupationDescription');
    expect(company).not.toHaveProperty('email');
  });

  it('pads digit strings to the field width and removes all-zero optional ones', () => {
    const result = canonicalize(
      minimalInput({
        company: {
          fileNumber: '12345',
          withholdingFileNumber: '7',
          vatFileNumber: '000000000',
          fax: { prefix: '052', number: '12345' },
        },
        shareholders: [{ idNumber: '12', fullName: 'א', isControllingShareholder: true }],
      }),
      OPTIONS,
    );
    expect(result.company.fileNumber).toBe('000012345');
    expect(result.company.withholdingFileNumber).toBe('000000007');
    expect(result.company).not.toHaveProperty('vatFileNumber');
    expect(result.company.fax).toEqual({ prefix: '052', number: '0012345' });
    expect(result.shareholders[0]?.idNumber).toBe('000000012');
  });

  it('removes zero codes unless they are zeroAllowed', () => {
    const { amounts } = canonicalize(
      minimalInput({ amounts: { '010': 0, '080': 0, '070': 5 } }),
      OPTIONS,
    );
    expect(amounts).toEqual({
      '018': 4,
      '072': 0,
      '080': 0,
      '081': 1000,
      '094': 0,
      '263': 1,
      '070': 5,
    });
  });

  it('removes false flags and optional zero numbers, keeping required yes/no false', () => {
    const [shareholder] = canonicalize(
      minimalInput({
        shareholders: [
          {
            idNumber: '123456782',
            fullName: 'ישראל ישראלי',
            isControllingShareholder: false,
            dividendRightsPercent: 0,
            isMaterialShareholder: false,
            salaryMonths1To9: 0,
            otherPayments: 7,
          },
        ],
      }),
      OPTIONS,
    ).shareholders;
    expect(shareholder).toEqual({
      idNumber: '123456782',
      fullName: 'ישראל ישראלי',
      isControllingShareholder: false,
      otherPayments: 7,
    });
  });

  it('drops a phone prefix the normalizer drops', () => {
    const input = minimalInput({
      company: { fax: { prefix: '01' as PhonePrefix, number: '7654321' } },
    });
    expect(canonicalize(input, OPTIONS).company.fax).toEqual({ number: '7654321' });
  });

  it('rounds amounts like generation when rounding is halfUp', () => {
    const input = minimalInput({
      amounts: { '081': 1000.5, '010': 0.4 },
      shareholders: [
        {
          idNumber: '123456782',
          fullName: 'ישראל ישראלי',
          isControllingShareholder: true,
          salaryMonths1To9: 10.5,
        },
      ],
    });
    const result = canonicalize(input, { ...OPTIONS, rounding: 'halfUp' });
    expect(result.amounts['081']).toBe(1001);
    expect(result.amounts).not.toHaveProperty('010');
    expect(result.shareholders[0]?.salaryMonths1To9).toBe(11);
  });

  it('does not change its input', () => {
    const input: Report1214Input = minimalInput({ company: { fileNumber: '12' } });
    const copy = structuredClone(input);
    canonicalize(input, OPTIONS);
    expect(input).toEqual(copy);
  });
});
