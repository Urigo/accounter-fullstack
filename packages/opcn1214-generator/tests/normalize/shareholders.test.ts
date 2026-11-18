import { getLayout } from '../../src/layout/registry.js';
import type { Shareholder } from '../../src/model/input.js';
import { normalizeReport } from '../../src/normalize/report.js';
import { minimalInput } from '../fixtures/builders.js';

const LAYOUT = getLayout(2024);
const OPTIONS = { today: () => '2024-06-30' };

const FIRST: Shareholder = {
  idNumber: '123456782',
  fullName: '  ישראל\u00A0 ישראלי ',
  isControllingShareholder: true,
  dividendRightsPercent: 60,
  votingRightsPercent: 50.5,
  otherRightsPercent: 10.25,
  isMaterialShareholder: true,
  salaryMonths1To9: 90000,
  salaryMonths10To12: 30000,
  otherPayments: 0,
};
const SECOND: Shareholder = {
  idNumber: '999999964',
  fullName: 'חברה זרה',
  isControllingShareholder: false,
  dividendRightsPercent: 40,
};

function shareholderRecords(shareholders: Shareholder[]) {
  return normalizeReport(minimalInput({ shareholders }), LAYOUT, OPTIONS).records.filter(
    record => record.recordType === '1020',
  );
}

describe('normalizeReport: records 1020 (shareholders)', () => {
  it('emits one record per shareholder, in input order, after record 1000', () => {
    const report = normalizeReport(
      minimalInput({ shareholders: [FIRST, SECOND] }),
      LAYOUT,
      OPTIONS,
    );
    expect(report.records.map(r => [r.recordType, r.index])).toEqual([
      ['1000', 0],
      ['1020', 0],
      ['1020', 1],
    ]);
  });

  it('maps every key with its value and path', () => {
    const [first, second] = shareholderRecords([FIRST, SECOND]);
    expect(first?.values).toEqual({
      serialNumber: 1,
      idNumber: '123456782',
      fullName: 'ישראל ישראלי',
      isControllingShareholder: true,
      dividendRightsPercent: 60,
      votingRightsPercent: 50.5,
      otherRightsPercent: 10.25,
      isMaterialShareholder: true,
      salaryMonths1To9: 90000,
      salaryMonths10To12: 30000,
      otherPayments: 0,
    });
    expect(first?.paths).toEqual({
      serialNumber: '',
      idNumber: 'shareholders[0].idNumber',
      fullName: 'shareholders[0].fullName',
      isControllingShareholder: 'shareholders[0].isControllingShareholder',
      dividendRightsPercent: 'shareholders[0].dividendRightsPercent',
      votingRightsPercent: 'shareholders[0].votingRightsPercent',
      otherRightsPercent: 'shareholders[0].otherRightsPercent',
      isMaterialShareholder: 'shareholders[0].isMaterialShareholder',
      salaryMonths1To9: 'shareholders[0].salaryMonths1To9',
      salaryMonths10To12: 'shareholders[0].salaryMonths10To12',
      otherPayments: 'shareholders[0].otherPayments',
    });
    expect(second?.values).toEqual({
      serialNumber: 2,
      idNumber: '999999964',
      fullName: 'חברה זרה',
      isControllingShareholder: false,
      dividendRightsPercent: 40,
    });
    expect(second?.paths).toEqual({
      serialNumber: '',
      idNumber: 'shareholders[1].idNumber',
      fullName: 'shareholders[1].fullName',
      isControllingShareholder: 'shareholders[1].isControllingShareholder',
      dividendRightsPercent: 'shareholders[1].dividendRightsPercent',
    });
  });

  it('sets index (0-based) and serialNumber (1-based)', () => {
    const records = shareholderRecords([SECOND, FIRST, SECOND]);
    expect(records.map(r => [r.index, r.values.serialNumber])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
    ]);
  });

  it('every key it sets is a field of record 1020; no codes or countries', () => {
    const keys = new Set(LAYOUT.records['1020'].fields.map(field => field.key));
    const [record] = shareholderRecords([FIRST]);
    expect(Object.keys(record?.values ?? {}).every(key => keys.has(key))).toBe(true);
    expect(record?.codes.size).toBe(0);
    expect(record?.countries).toEqual([]);
  });

  it('keeps an idNumber that is not all digits as-is', () => {
    const [record] = shareholderRecords([{ ...SECOND, idNumber: '12-34' }]);
    expect(record?.values.idNumber).toBe('12-34');
  });

  it('emits no 1020 records for no shareholders', () => {
    expect(shareholderRecords([])).toEqual([]);
  });
});
