import { describe, expect, it, vi } from 'vitest';
import {
  calendarDay,
  fetchAllExecutions,
  MYTRADE_EXECUTIONS_MAX_ROUNDS,
  MYTRADE_EXECUTIONS_PAGE_SIZE,
  oldestExecutionDay,
} from '../hapoalim-securities-paging.js';

/** A .NET round-trip timestamp for a calendar day, as the bank sends them. */
const at = (day: string) => `${day}T00:00:00.0000000+03:00`;

/** `YYYY-MM-DD` of a local date — `toISOString` would shift the day west of UTC. */
const localDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

/** An execution identified by its security number and value date. */
const execution = (security: string, day: string) => ({
  Security: security,
  TradeDate: at(day),
  ValueDate: at(day),
  SettlementDate: at(day),
  TradeType: 'קניה',
  TransactionType: 'קניה',
  NV: 10,
  TradePrice: 100,
  NetValueTradeCurrency: -1000,
  PaymentType: null,
  PaymentDate: null,
  ExDate: null,
  CancelDate: null,
});

const page = (executions: unknown[]) => ({ Account: { PageState: 'opaque', Execution: executions } });

/** A full page whose executions descend one day at a time from `endDay`. */
function fullPageEndingOn(endDay: string, prefix: string) {
  const end = new Date(`${endDay}T00:00:00Z`);
  return Array.from({ length: MYTRADE_EXECUTIONS_PAGE_SIZE }, (_, index) => {
    const day = new Date(end.getTime() - index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return execution(`${prefix}${index}`, day);
  });
}

const window = { fromDate: new Date(2024, 0, 1), toDate: new Date(2024, 11, 31) };

describe('fetchAllExecutions', () => {
  it('does not ask for a second page when the first is short', async () => {
    const fetchPage = vi.fn().mockResolvedValue(page([execution('1234567', '2024-06-01')]));

    const result = await fetchAllExecutions({ ...window, fetchPage });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.rounds).toBe(1);
    expect(result.executions).toHaveLength(1);
    expect(result.truncated).toBeUndefined();
  });

  it('pages back over the oldest day of a full page until a short page arrives', async () => {
    // 150 executions ending on 2024-06-01 reach back to 2024-01-04.
    const first = fullPageEndingOn('2024-06-01', 'a');
    const second = [execution('7654321', '2024-01-03')];
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page(first))
      .mockResolvedValueOnce(page(second));

    const result = await fetchAllExecutions({ ...window, fetchPage });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    // The second round asks for the same window, ceilinged at the oldest day reached.
    expect(fetchPage.mock.calls[1]![0]).toEqual({
      fromDate: window.fromDate,
      toDate: new Date(2024, 0, 4),
    });
    expect(result.executions).toHaveLength(MYTRADE_EXECUTIONS_PAGE_SIZE + 1);
    expect(result.truncated).toBeUndefined();
  });

  it('drops the executions the overlapping ceiling day repeats', async () => {
    const first = fullPageEndingOn('2024-06-01', 'a');
    const boundary = first.at(-1)!;
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page(first))
      // The re-requested ceiling day comes back with the row already seen, plus an
      // older one that the first page had no room for.
      .mockResolvedValueOnce(page([boundary, execution('9999999', '2024-01-04')]));

    const result = await fetchAllExecutions({ ...window, fetchPage });

    expect(result.executions).toHaveLength(MYTRADE_EXECUTIONS_PAGE_SIZE + 1);
    expect(result.executions.filter(row => row === boundary)).toHaveLength(1);
  });

  it('stops instead of looping when a full page sits on a single day', async () => {
    const sameDay = Array.from({ length: MYTRADE_EXECUTIONS_PAGE_SIZE }, (_, index) =>
      execution(`b${index}`, '2024-06-01'),
    );
    const fetchPage = vi.fn().mockResolvedValue(page(sameDay));
    const warn = vi.fn();

    const result = await fetchAllExecutions({ ...window, fetchPage, warn });

    // Round 1 ends the window at 2024-12-31, round 2 at 2024-06-01 — which the
    // page cannot get past, so there is no round 3.
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.executions).toHaveLength(MYTRADE_EXECUTIONS_PAGE_SIZE);
    expect(result.truncated).toContain('2024-06-01');
    expect(warn).toHaveBeenCalledWith(result.truncated);
  });

  it('gives up after the round cap and says how far it got', async () => {
    // Every page is full and reaches exactly one day further back than its
    // ceiling, so the walk-back makes progress but never terminates on its own.
    const fetchPage = vi.fn().mockImplementation(({ toDate }: { toDate: Date }) => {
      const ceilingDay = localDay(toDate);
      const olderDay = localDay(new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate() - 1));
      const rows = Array.from({ length: MYTRADE_EXECUTIONS_PAGE_SIZE }, (_, index) =>
        execution(`c${ceilingDay}-${index}`, index === 0 ? olderDay : ceilingDay),
      );
      return Promise.resolve(page(rows));
    });
    const warn = vi.fn();

    const result = await fetchAllExecutions({
      fromDate: new Date(2020, 0, 1),
      toDate: new Date(2024, 11, 31),
      fetchPage,
      warn,
    });

    expect(fetchPage).toHaveBeenCalledTimes(MYTRADE_EXECUTIONS_MAX_ROUNDS);
    expect(result.rounds).toBe(MYTRADE_EXECUTIONS_MAX_ROUNDS);
    expect(result.truncated).toContain(`${MYTRADE_EXECUTIONS_MAX_ROUNDS} rounds`);
  });

  it('stops once a full page reaches past the start of the window', async () => {
    const fetchPage = vi.fn().mockResolvedValue(page(fullPageEndingOn('2024-06-01', 'd')));

    const result = await fetchAllExecutions({
      // The first page reaches back to 2024-01-04, before this floor.
      fromDate: new Date(2024, 2, 1),
      toDate: new Date(2024, 11, 31),
      fetchPage,
    });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.truncated).toBeUndefined();
  });

  it('keeps the first page and stops when a round comes back empty-handed', async () => {
    const fetchPage = vi.fn().mockResolvedValue(null);

    const result = await fetchAllExecutions({ ...window, fetchPage });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.firstPage).toBeNull();
    expect(result.executions).toEqual([]);
  });

  it('stops on an error payload without swallowing it', async () => {
    const errorPage = { Exception: { Message: 'InvalidSessionException' } };
    const fetchPage = vi.fn().mockResolvedValue(errorPage);

    const result = await fetchAllExecutions({
      ...window,
      fetchPage,
      isErrorPage: candidate => 'Exception' in (candidate as Record<string, unknown>),
    });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.firstPage).toBe(errorPage);
    expect(result.executions).toEqual([]);
  });

  it('treats a response with no Execution list as an empty page', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ Account: { PageState: null } });

    const result = await fetchAllExecutions({ ...window, fetchPage });

    expect(result.executions).toEqual([]);
  });
});

describe('oldestExecutionDay', () => {
  it('takes the minimum rather than trusting the response order', () => {
    expect(
      oldestExecutionDay([
        execution('1', '2024-03-05'),
        execution('2', '2024-01-09'),
        execution('3', '2024-02-01'),
      ]),
    ).toBe('2024-01-09');
  });

  it('falls back to the trade date when an execution has no value date', () => {
    expect(
      oldestExecutionDay([{ ...execution('1', '2024-03-05'), ValueDate: null }]),
    ).toBe('2024-03-05');
  });

  it('ignores rows with no usable date at all', () => {
    expect(oldestExecutionDay([{ ValueDate: null, TradeDate: null }])).toBeNull();
    expect(oldestExecutionDay([])).toBeNull();
  });
});

describe('calendarDay', () => {
  it('reads the day off the string, without a timezone in the way', () => {
    // Parsed as a Date in a western timezone this is 2024-03-04.
    expect(calendarDay('2024-03-05T00:00:00.0000000+03:00')).toBe('2024-03-05');
  });

  it('rejects the year-1 sentinel and anything unparseable', () => {
    expect(calendarDay('0001-01-01T00:00:00.0000000')).toBeNull();
    expect(calendarDay('05/03/2024')).toBeNull();
    expect(calendarDay(null)).toBeNull();
  });
});
