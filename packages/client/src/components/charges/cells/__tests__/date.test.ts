import { describe, expect, it } from 'vitest';
import { getDateProps } from '../date.js';

describe('charges table date cell', () => {
  it('shows the documents date, and the overall range, as the calendar days received', () => {
    const props = getDateProps({
      minDocumentsDate: '2026-05-01',
      maxDocumentsDate: '2026-05-01',
      minEventDate: '2026-04-30',
      maxEventDate: '2026-05-02',
      minDebitDate: '2026-05-31',
      maxDebitDate: '2026-06-01',
    });
    expect(props).toEqual({
      date: '2026-05-01',
      mostMinDate: '2026-04-30',
      mostMaxDate: '2026-06-01',
    });
  });

  it('falls back to the event date, then the debit date', () => {
    const base = {
      minDocumentsDate: null,
      maxDocumentsDate: null,
      maxEventDate: null,
      maxDebitDate: null,
    };
    expect(
      getDateProps({ ...base, minEventDate: '2026-01-01', minDebitDate: '2026-01-02' })?.date,
    ).toBe('2026-01-01');
    expect(getDateProps({ ...base, minEventDate: null, minDebitDate: '2026-01-02' })?.date).toBe(
      '2026-01-02',
    );
    expect(getDateProps({ ...base, minEventDate: null, minDebitDate: null })).toBeUndefined();
  });
});
