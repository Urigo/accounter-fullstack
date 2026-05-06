import { describe, expect, it, vi, afterEach } from 'vitest';
import { scrapeCurrencyRates } from '../currency-rates.js';

const noop = () => {};

// Minimal valid BOI XML with one currency (USD) and one past date
const VALID_BOI_XML = `<?xml version="1.0" encoding="UTF-8"?>
<message:StructureSpecificData xmlns:message="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message">
  <message:DataSet>
    <Series BASE_CURRENCY="USD">
      <Obs TIME_PERIOD="2024-01-01" OBS_VALUE="3.65"/>
    </Series>
  </message:DataSet>
</message:StructureSpecificData>`;

// XML with an unsupported currency
const BAD_CURRENCY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<message:StructureSpecificData xmlns:message="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message">
  <message:DataSet>
    <Series BASE_CURRENCY="XYZ">
      <Obs TIME_PERIOD="2024-01-01" OBS_VALUE="1.0"/>
    </Series>
  </message:DataSet>
</message:StructureSpecificData>`;

// XML that produces no valid entries (empty series)
const EMPTY_BOI_XML = `<?xml version="1.0" encoding="UTF-8"?>
<message:StructureSpecificData xmlns:message="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message">
  <message:DataSet>
  </message:DataSet>
</message:StructureSpecificData>`;

function mockFetch(xml: string, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      statusText: ok ? 'OK' : 'Internal Server Error',
      text: () => Promise.resolve(xml),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scrapeCurrencyRates — happy path', () => {
  it('resolves with a validated CurrencyRatesPayload', async () => {
    mockFetch(VALID_BOI_XML);

    const result = await scrapeCurrencyRates(noop, new Date('2024-01-01'), new Date('2024-01-02'));

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toMatchObject({ date: '2024-01-01', currency: 'USD', rate: 3.65 });
  });
});

describe('scrapeCurrencyRates — fetch error', () => {
  it('throws when the BOI fetch returns a non-OK status', async () => {
    mockFetch('', false);

    await expect(scrapeCurrencyRates(noop, new Date('2024-01-01'), new Date('2024-01-02'))).rejects.toThrow('BOI fetch failed');
  });
});

describe('scrapeCurrencyRates — empty response', () => {
  it('returns an empty array when no valid series are found', async () => {
    mockFetch(EMPTY_BOI_XML);

    // No series → no entries → empty validated array
    const result = await scrapeCurrencyRates(noop, new Date('2024-01-01'), new Date('2024-01-02'));
    expect(result).toEqual([]);
  });
});

describe('scrapeCurrencyRates — unsupported currency', () => {
  it('skips entries with unsupported currencies without throwing', async () => {
    mockFetch(BAD_CURRENCY_XML);

    const result = await scrapeCurrencyRates(noop, new Date('2024-01-01'), new Date('2024-01-02'));
    expect(result).toEqual([]);
  });
});

describe('scrapeCurrencyRates — NaN rate', () => {
  it('skips entries where OBS_VALUE is not a valid number', async () => {
    const badRateXml = `<?xml version="1.0" encoding="UTF-8"?>
<message:StructureSpecificData xmlns:message="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message">
  <message:DataSet>
    <Series BASE_CURRENCY="USD">
      <Obs TIME_PERIOD="2024-01-01" OBS_VALUE="not-a-number"/>
    </Series>
  </message:DataSet>
</message:StructureSpecificData>`;

    mockFetch(badRateXml);

    // NaN is filtered out by the isNaN guard, resulting in an empty array
    const result = await scrapeCurrencyRates(noop, new Date('2024-01-01'), new Date('2024-01-02'));
    expect(result).toEqual([]);
  });
});
