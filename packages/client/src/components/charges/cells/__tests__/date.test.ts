import { format } from 'date-fns';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDateProps } from '../date.js';

const TIMEZONES = ['UTC', 'Asia/Jerusalem', 'America/New_York', 'Pacific/Pago_Pago'];

describe.each(TIMEZONES)('charges table date cell with TZ=%s', timeZone => {
  let previous: string | undefined;
  beforeAll(() => {
    previous = process.env['TZ'];
    process.env['TZ'] = timeZone;
  });
  afterAll(() => {
    if (previous === undefined) delete process.env['TZ'];
    else process.env['TZ'] = previous;
  });

  const show = (date?: Date) => (date ? format(date, 'yyyy-MM-dd') : undefined);

  it('shows the documents date, and the overall range, as the calendar days received', () => {
    const props = getDateProps({
      minDocumentsDate: '2026-05-01',
      maxDocumentsDate: '2026-05-01',
      minEventDate: '2026-04-30',
      maxEventDate: '2026-05-02',
      minDebitDate: '2026-05-31',
      maxDebitDate: '2026-06-01',
    });
    expect(show(props?.date)).toBe('2026-05-01');
    expect(show(props?.mostMinDate)).toBe('2026-04-30');
    expect(show(props?.mostMaxDate)).toBe('2026-06-01');
  });

  it('falls back to the event date, then the debit date', () => {
    const base = {
      minDocumentsDate: null,
      maxDocumentsDate: null,
      maxEventDate: null,
      maxDebitDate: null,
    };
    expect(
      show(getDateProps({ ...base, minEventDate: '2026-01-01', minDebitDate: '2026-01-02' })?.date),
    ).toBe('2026-01-01');
    expect(show(getDateProps({ ...base, minEventDate: null, minDebitDate: '2026-01-02' })?.date)).toBe(
      '2026-01-02',
    );
    expect(getDateProps({ ...base, minEventDate: null, minDebitDate: null })).toBeUndefined();
  });
});
