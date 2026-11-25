import { getLayout } from '../../src/layout/registry.js';
import type { RecordDef } from '../../src/layout/types.js';
import { phonePrefix } from '../../src/normalize/phone.js';
import type { Issue } from '../../src/validate/issue.js';

const RECORD_1000 = getLayout(2024).records['1000'];

/** Record 1000 with the allowed values of 1000@493 replaced by `values` (one source: the layout). */
function withPhonePrefixValues(values: readonly number[]): RecordDef {
  return {
    ...RECORD_1000,
    fields: RECORD_1000.fields.map(field =>
      field.key === 'company.phone.prefix'
        ? { ...field, values: values.map(value => ({ value })) }
        : field,
    ),
  };
}

describe('phonePrefix (SPEC §4.2, §10.2 field.phonePrefix)', () => {
  it('takes the allowed prefixes from the field values of the layout, like the codec', () => {
    const def = withPhonePrefixValues([2, 51]);
    const notices: Issue[] = [];
    expect(phonePrefix(def, 0, 'company.phone.prefix', '051', notices)).toBe('051');
    expect(phonePrefix(def, 0, 'company.phone.prefix', '03', notices)).toBeUndefined();
    expect(notices).toEqual([
      expect.objectContaining({
        ruleId: 'field.phonePrefix',
        value: '03',
        expected: 'one of 02, 051',
      }),
    ]);
  });

  it('keeps an absent prefix without a notice', () => {
    const notices: Issue[] = [];
    expect(phonePrefix(RECORD_1000, 0, 'company.phone.prefix', undefined, notices)).toBeUndefined();
    expect(phonePrefix(RECORD_1000, 0, 'company.phone.prefix', '', notices)).toBe('');
    expect(notices).toEqual([]);
  });
});
