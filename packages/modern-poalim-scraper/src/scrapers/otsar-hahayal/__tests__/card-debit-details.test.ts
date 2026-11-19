import { describe, expect, it, vi } from 'vitest';
import {
  cardLastFourOfDrillDown,
  drillDownTypeOfUrl,
  enrichCardDebitRows,
  mayBeCardDebitDrillDown,
  type CardDebitDetailsRow,
} from '../card-debit-details.js';

function cardBreakdown(lastFour: unknown) {
  return {
    T20C2211: {
      'OUT-DATA': {
        'ALL-CARDS': {
          'KARTIS-DETAILS': { 'OUT-MSKART': lastFour },
        },
      },
    },
  };
}

const TRANSFER_DRILL_DOWN = {
  T10C1523: { 'OUT-DATA': { 'OUT-DETAILS': { 'WS-DATA-2': { 'WS-TS-ASM': '9999' } } } },
};

describe('drillDownTypeOfUrl', () => {
  it('reads the SUGBAKA parameter, without leading zeros', () => {
    expect(drillDownTypeOfUrl('/path/servlet?SUGBAKA=211&X=1')).toBe('211');
    expect(drillDownTypeOfUrl('/path/servlet?X=1&sugbaka=0523')).toBe('523');
  });

  it('is null when the URL names no type', () => {
    expect(drillDownTypeOfUrl('/path/servlet?X=1')).toBeNull();
    expect(drillDownTypeOfUrl('/path/servlet?NOTSUGBAKA=211')).toBeNull();
  });
});

describe('mayBeCardDebitDrillDown', () => {
  it('keeps card-breakdown URLs and URLs that name no type', () => {
    expect(mayBeCardDebitDrillDown('/a?SUGBAKA=211')).toBe(true);
    expect(mayBeCardDebitDrillDown('/a?X=1')).toBe(true);
  });

  it('skips other drill-down types, security-name pages and empty URLs', () => {
    expect(mayBeCardDebitDrillDown('/a?SUGBAKA=523')).toBe(false);
    expect(mayBeCardDebitDrillDown('/a?SUGBAKA=526')).toBe(false);
    expect(mayBeCardDebitDrillDown('/x/PaperNameServiceServlet?id=1')).toBe(false);
    expect(mayBeCardDebitDrillDown('')).toBe(false);
  });
});

describe('cardLastFourOfDrillDown', () => {
  it('reads OUT-MSKART of a card breakdown', () => {
    expect(cardLastFourOfDrillDown(cardBreakdown('1234'))).toBe('1234');
    expect(cardLastFourOfDrillDown(cardBreakdown(' 0042 '))).toBe('0042');
  });

  it('ignores other drill-down types and malformed breakdowns', () => {
    expect(cardLastFourOfDrillDown(TRANSFER_DRILL_DOWN)).toBeNull();
    expect(cardLastFourOfDrillDown('a security name')).toBeNull();
    expect(cardLastFourOfDrillDown(null)).toBeNull();
    expect(cardLastFourOfDrillDown(cardBreakdown('12345'))).toBeNull();
    expect(cardLastFourOfDrillDown(cardBreakdown(1234))).toBeNull();
    // a breakdown of several cards names no single card
    expect(
      cardLastFourOfDrillDown({
        T20C2211: { 'OUT-DATA': { 'ALL-CARDS': [{ 'KARTIS-DETAILS': { 'OUT-MSKART': '1234' } }] } },
      }),
    ).toBeNull();
  });
});

describe('enrichCardDebitRows', () => {
  const silentLogger = { warn: vi.fn() };

  it('sets the card hint on card-debit rows only, fetching each candidate URL once', async () => {
    const rows: CardDebitDetailsRow[] = [
      { drillDownUrl: '/a?SUGBAKA=211&ID=1' },
      { drillDownUrl: '/a?SUGBAKA=211&ID=1' },
      { drillDownUrl: '/a?SUGBAKA=523&ID=2' },
      { drillDownUrl: '/a?ID=3' },
      { drillDownUrl: '' },
    ];
    const fetchDrillDown = vi.fn(async (url: string) =>
      url.includes('ID=1') ? cardBreakdown('1234') : TRANSFER_DRILL_DOWN,
    );

    const result = await enrichCardDebitRows(rows, fetchDrillDown, silentLogger);

    expect(fetchDrillDown.mock.calls.map(([url]) => url)).toEqual(['/a?SUGBAKA=211&ID=1', '/a?ID=3']);
    expect(result).toEqual({ enriched: 2, failed: 0 });
    expect(rows[0]).toMatchObject({ originReference: '1234', drillDownData: cardBreakdown('1234') });
    expect(rows[1]).toMatchObject({ originReference: '1234' });
    // a fetched response of another type sets nothing
    expect(rows[3]).toEqual({ drillDownUrl: '/a?ID=3' });
    expect(rows[2]).toEqual({ drillDownUrl: '/a?SUGBAKA=523&ID=2' });
  });

  it('keeps a row without its hint when its drill-down fails, and goes on', async () => {
    const rows: CardDebitDetailsRow[] = [
      { drillDownUrl: '/a?SUGBAKA=211&ID=1' },
      { drillDownUrl: '/a?SUGBAKA=211&ID=2' },
    ];
    const logger = { warn: vi.fn() };
    const fetchDrillDown = vi.fn(async (url: string) => {
      if (url.includes('ID=1')) {
        throw new Error('network down');
      }
      return cardBreakdown('5678');
    });

    const result = await enrichCardDebitRows(rows, fetchDrillDown, logger);

    expect(result).toEqual({ enriched: 1, failed: 1 });
    expect(rows[0]).toEqual({ drillDownUrl: '/a?SUGBAKA=211&ID=1' });
    expect(rows[1]).toMatchObject({ originReference: '5678' });
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(String(logger.warn.mock.calls[0]?.[0])).toContain('network down');
  });
});
