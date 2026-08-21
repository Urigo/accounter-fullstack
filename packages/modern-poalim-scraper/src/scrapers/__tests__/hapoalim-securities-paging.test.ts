import { describe, expect, it, vi } from 'vitest';
import {
  executionIdentity,
  fetchAllExecutions,
  MYTRADE_EXECUTIONS_MAX_ROUNDS,
} from '../hapoalim-securities-paging.js';

/** A .NET round-trip timestamp for a calendar day, as the bank sends them. */
const at = (day: string) => `${day}T00:00:00.0000000+03:00`;

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

/**
 * A response. `pageState` is the cursor the bank hands back: a string means "there is
 * more", null means the window is exhausted.
 */
const page = (executions: unknown[], pageState: string | null = null) => ({
  Account: { PageState: pageState, Execution: executions },
});

const window = { fromDate: new Date(2024, 0, 1), toDate: new Date(2024, 11, 31) };

/** mytrade signals failure in the body; the scraper passes an equivalent predicate. */
const isException = (candidate: unknown) => 'Exception' in (candidate as Record<string, unknown>);

describe('fetchAllExecutions', () => {
  it('issues one request when the first page has no cursor', async () => {
    const fetchPage = vi.fn().mockResolvedValue(page([execution('1234567', '2024-06-01')]));

    const result = await fetchAllExecutions({ ...window, fetchPage });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith({ fromDate: window.fromDate, toDate: window.toDate });
    expect(result.executions).toHaveLength(1);
    expect(result.rounds).toBe(1);
    expect(result.truncated).toBeUndefined();
  });

  it('treats a missing cursor as exhausted', async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      Account: { Execution: [execution('1234567', '2024-06-01')] },
    });

    const result = await fetchAllExecutions({ ...window, fetchPage });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.executions).toHaveLength(1);
  });

  it('treats an empty-string cursor as exhausted', async () => {
    const fetchPage = vi.fn().mockResolvedValue(page([execution('1234567', '2024-06-01')], '   '));

    const result = await fetchAllExecutions({ ...window, fetchPage });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.executions).toHaveLength(1);
  });

  it('follows the cursor with the date window unchanged', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page([execution('1', '2024-06-01')], 'cursor-1'))
      .mockResolvedValueOnce(page([execution('2', '2024-05-01')], 'cursor-2'))
      .mockResolvedValueOnce(page([execution('3', '2024-04-01')]));

    const result = await fetchAllExecutions({ ...window, fetchPage });

    expect(fetchPage).toHaveBeenCalledTimes(3);
    // Round 1 carries no cursor; every later round repeats the same window and only
    // moves `pageState` — the whole point of the change away from a date walk-back.
    expect(fetchPage).toHaveBeenNthCalledWith(1, {
      fromDate: window.fromDate,
      toDate: window.toDate,
    });
    expect(fetchPage).toHaveBeenNthCalledWith(2, {
      fromDate: window.fromDate,
      toDate: window.toDate,
      pageState: 'cursor-1',
    });
    expect(fetchPage).toHaveBeenNthCalledWith(3, {
      fromDate: window.fromDate,
      toDate: window.toDate,
      pageState: 'cursor-2',
    });
    expect(result.executions).toHaveLength(3);
    expect(result.rounds).toBe(3);
    expect(result.truncated).toBeUndefined();
  });

  it('passes an opaque base64 cursor through verbatim', async () => {
    const cursor =
      'eyJOcGNucHRuMSI6W3siTWlzcGFyQmFuayI6MCwiTWlzcGFyU25pZiI6MCwiTWlzcGFyQ2hlc2hib24iOjAsIk1pc3BhclJhdHoiOjEwMDk5OTksIlRhYXJpY2g4TmVjaG9udXQiOjIwMjUwOTA1fV19';
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page([execution('1', '2024-06-01')], cursor))
      .mockResolvedValueOnce(page([execution('2', '2024-05-01')]));

    await fetchAllExecutions({ ...window, fetchPage });

    expect(fetchPage).toHaveBeenNthCalledWith(2, expect.objectContaining({ pageState: cursor }));
  });

  it('keeps paging on a short page that still has a cursor', async () => {
    // Row count is no longer a signal — only the cursor is.
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page([execution('1', '2024-06-01')], 'cursor-1'))
      .mockResolvedValueOnce(page([execution('2', '2024-05-01')]));

    const result = await fetchAllExecutions({ ...window, fetchPage });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.executions).toHaveLength(2);
  });

  it('stops on a long page with no cursor', async () => {
    const rows = Array.from({ length: 150 }, (_, index) => execution(`${index}`, '2024-06-01'));
    const fetchPage = vi.fn().mockResolvedValue(page(rows));

    const result = await fetchAllExecutions({ ...window, fetchPage });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.executions).toHaveLength(150);
    expect(result.truncated).toBeUndefined();
  });

  it('drops rows two pages share', async () => {
    const shared = execution('1234567', '2024-06-01');
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page([shared, execution('2', '2024-05-02')], 'cursor-1'))
      .mockResolvedValueOnce(page([shared, execution('3', '2024-04-03')]));

    const result = await fetchAllExecutions({ ...window, fetchPage });

    expect(result.executions).toHaveLength(3);
  });

  it('stops when the cursor comes back unchanged', async () => {
    const warn = vi.fn();
    const fetchPage = vi.fn().mockResolvedValue(page([execution('1', '2024-06-01')], 'stuck'));

    const result = await fetchAllExecutions({ ...window, fetchPage, warn });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.rounds).toBe(2);
    expect(result.truncated).toContain('same paging cursor twice');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('gives up at the round cap when the cursor never goes null', async () => {
    const warn = vi.fn();
    let round = 0;
    const fetchPage = vi.fn().mockImplementation(() => {
      round += 1;
      return Promise.resolve(page([execution(`${round}`, '2024-06-01')], `cursor-${round}`));
    });

    const result = await fetchAllExecutions({ ...window, fetchPage, warn });

    expect(fetchPage).toHaveBeenCalledTimes(MYTRADE_EXECUTIONS_MAX_ROUNDS);
    expect(result.rounds).toBe(MYTRADE_EXECUTIONS_MAX_ROUNDS);
    expect(result.executions).toHaveLength(MYTRADE_EXECUTIONS_MAX_ROUNDS);
    expect(result.truncated).toContain(`${MYTRADE_EXECUTIONS_MAX_ROUNDS} rounds`);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('reports a round that comes back with nothing while the cursor is open', async () => {
    const warn = vi.fn();
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page([execution('1', '2024-06-01')], 'cursor-1'))
      .mockResolvedValueOnce(null);

    const result = await fetchAllExecutions({ ...window, fetchPage, warn });

    expect(result.executions).toHaveLength(1);
    expect(result.truncated).toContain('came back with nothing');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('says nothing when the very first round comes back empty', async () => {
    const warn = vi.fn();
    const fetchPage = vi.fn().mockResolvedValue(null);

    const result = await fetchAllExecutions({ ...window, fetchPage, warn });

    expect(result.firstPage).toBeNull();
    expect(result.executions).toEqual([]);
    expect(result.truncated).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps an error payload from the first round', async () => {
    const errorPage = { Exception: { '-ExceptionType': 'x', Message: 'boom' } };
    const fetchPage = vi.fn().mockResolvedValue(errorPage);

    const result = await fetchAllExecutions({ ...window, fetchPage, isErrorPage: isException });

    expect(result.failedPage).toBe(errorPage);
    expect(result.executions).toEqual([]);
  });

  it('keeps an error payload that arrives after a good page', async () => {
    const errorPage = { Exception: { '-ExceptionType': 'x', Message: 'boom' } };
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page([execution('1', '2024-06-01')], 'cursor-1'))
      .mockResolvedValueOnce(errorPage);

    const result = await fetchAllExecutions({ ...window, fetchPage, isErrorPage: isException });

    expect(result.failedPage).toBe(errorPage);
    expect(result.executions).toHaveLength(1);
  });

  it('tolerates a page with no execution list', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ Account: { PageState: null } });

    const result = await fetchAllExecutions({ ...window, fetchPage });

    expect(result.executions).toEqual([]);
    expect(result.truncated).toBeUndefined();
  });
});

describe('executionIdentity', () => {
  it('matches two rows that agree on the ingestion dedup key', () => {
    const row = execution('1234567', '2024-06-01');
    expect(executionIdentity({ ...row, EngName: 'ACME' })).toBe(
      executionIdentity({ ...row, EngName: 'other' }),
    );
  });

  it('separates rows that differ on a key field', () => {
    const row = execution('1234567', '2024-06-01');
    expect(executionIdentity(row)).not.toBe(executionIdentity({ ...row, TradePrice: 101 }));
  });
});
