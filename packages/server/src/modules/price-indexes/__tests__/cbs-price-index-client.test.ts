import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CbsPriceIndexClient,
  parseCbsPriceResponse,
} from '../../app-providers/cbs-price-index-client.js';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('parseCbsPriceResponse', () => {
  it('parses rows with chain coefficients', () => {
    const { entries, nextUrl } = parseCbsPriceResponse(fixture('cbs-latest-with-coefficients.json'));
    expect(nextUrl).toBeNull();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      indexCode: 120_010,
      year: 2026,
      month: 9,
      value: 105.3,
      baseLabel: 'Average 2024',
      monthlyChangePct: -0.5,
      yearlyChangePct: 1.6,
    });
    expect(entries[0].previousBases[0]).toEqual({ baseLabel: 'Average 2022', coefficient: 1.074 });
    expect(entries[0].previousBases.at(-1)).toEqual({
      baseLabel: 'September 1951',
      coefficient: 2.753,
    });
  });

  it('keeps each month in the base it was published in', () => {
    const { entries } = parseCbsPriceResponse(fixture('cbs-base-change-window.json'));
    expect(entries.map(entry => [entry.year, entry.month, entry.value, entry.baseLabel])).toEqual([
      [2025, 2, 101.5, 'Average 2024'],
      [2025, 1, 101.5, 'Average 2024'],
      [2024, 12, 108.4, 'Average 2022'],
      [2024, 11, 108.7, 'Average 2022'],
    ]);
    expect(entries.every(entry => entry.previousBases.length === 0)).toBe(true);
  });

  it('treats an empty series as no entries', () => {
    expect(
      parseCbsPriceResponse({ month: null, quarter: null, paging: { next_url: null } }).entries,
    ).toEqual([]);
  });

  it('rejects an unexpected shape', () => {
    expect(() => parseCbsPriceResponse({ month: [{ code: 120_010, date: [{ year: 2026 }] }] })).toThrow(
      /Unexpected CBS price index response/,
    );
  });
});

describe('CbsPriceIndexClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests JSON in English with a user agent and the requested range', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(fixture('cbs-base-change-window.json')));
    vi.stubGlobal('fetch', fetchMock);

    const entries = await new CbsPriceIndexClient().fetchValues(120_010, {
      startPeriod: '2024-11',
      withCoefficients: true,
    });

    expect(entries).toHaveLength(4);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const params = new URL(url).searchParams;
    expect(params.get('id')).toBe('120010');
    expect(params.get('format')).toBe('json');
    expect(params.get('lang')).toBe('en');
    expect(params.get('startPeriod')).toBe('11-2024');
    expect(params.get('coef')).toBe('true');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/accounter/);
  });

  it('follows pagination', async () => {
    const page = fixture('cbs-base-change-window.json') as { paging: Record<string, unknown> };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ ...page, paging: { ...page.paging, next_url: 'https://api.cbs.gov.il/next' } }),
      )
      .mockResolvedValueOnce(jsonResponse(page));
    vi.stubGlobal('fetch', fetchMock);

    const entries = await new CbsPriceIndexClient().fetchValues(120_010);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.cbs.gov.il/next');
    expect(entries).toHaveLength(8);
  });

  it('throws on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 503)));
    await expect(new CbsPriceIndexClient().fetchLatestWithChain(120_010)).rejects.toThrow(/503/);
  });
});
