import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IsraeliCorporationsRegistryClient,
  normalizeCorporationNumber,
  parseRegistryResponse,
} from '../israeli-corporations-registry.js';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const NOT_FOUND = { Data: [], Success: false };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseRegistryResponse', () => {
  it('maps a listed company, cleaning the padded values', () => {
    expect(
      parseRegistryResponse(fixture('israeli-corporations-registry-found.json'), '516232675'),
    ).toEqual({
      id: '516232675',
      name: 'הגילדה למוצרי תוכנה בע"מ',
      englishName: 'SOFTWARE PRODUCTS GUILDA LTD',
      status: 'פעילה',
      subStatus: null,
      corporationType: 'ישראלית',
      contactType: 'חברה',
      limitType: 'מוגבלת',
      purpose: 'לעסוק בכל עיסוק חוקי',
      registrationDate: '2020-08-02',
      lastAnnualReport: 2025,
      isGovernmental: false,
      violations: null,
      address: {
        street: 'הדקלים',
        houseNumber: '2',
        city: 'כפר קאסם',
        zipCode: '4881000',
        country: 'ישראל',
      },
    });
  });

  it('keeps registration dates from before 2000', () => {
    const json = fixture('israeli-corporations-registry-found.json') as {
      Data: Array<Record<string, unknown>>;
    };
    json.Data[0].DisplayCompanyRegistrationDate = '27/02/1951';
    expect(parseRegistryResponse(json, '516232675')?.registrationDate).toBe('1951-02-27');
  });

  it('treats an unsuccessful search as not found', () => {
    expect(parseRegistryResponse(NOT_FOUND, '516232675')).toBeNull();
  });

  it('ignores rows for another number', () => {
    expect(
      parseRegistryResponse(fixture('israeli-corporations-registry-found.json'), '520018078'),
    ).toBeNull();
  });

  it('rejects an unexpected shape', () => {
    expect(() => parseRegistryResponse({ Data: [{ DisplayId: '516232675' }] }, '516232675')).toThrow(
      /Unexpected Israeli corporations registry response/,
    );
  });
});

describe('normalizeCorporationNumber', () => {
  it('strips spaces and dashes', () => {
    expect(normalizeCorporationNumber(' 51-623267 5 ')).toBe('516232675');
  });
});

describe('IsraeliCorporationsRegistryClient', () => {
  it('posts the company number as a form search', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(fixture('israeli-corporations-registry-found.json')));
    vi.stubGlobal('fetch', fetchMock);

    const corporation = await new IsraeliCorporationsRegistryClient().getCorporationByNumber(
      '51-6232675',
    );

    expect(corporation?.name).toBe('הגילדה למוצרי תוכנה בע"מ');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ica.justice.gov.il/GenericCorporarionInfo/SearchGenericCorporation');
    expect(init.method).toBe('POST');
    expect(String(init.body)).toBe(
      'corporationType=3&corporationNumber=516232675&corporationName=',
    );
  });

  it('returns null for a number the registry does not list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(NOT_FOUND)));
    await expect(
      new IsraeliCorporationsRegistryClient().getCorporationByNumber('516232676'),
    ).resolves.toBeNull();
  });

  it('does not query the registry with a malformed number', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const client = new IsraeliCorporationsRegistryClient();

    await expect(client.getCorporationByNumber('abc')).resolves.toBeNull();
    await expect(client.getCorporationByNumber('51623267')).resolves.toBeNull();
    await expect(client.getCorporationByNumber('5162326750')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caches found and not-found results', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async (_url: string, init: RequestInit) =>
        String(init.body).includes('516232675')
          ? jsonResponse(fixture('israeli-corporations-registry-found.json'))
          : jsonResponse(NOT_FOUND),
      );
    vi.stubGlobal('fetch', fetchMock);
    const client = new IsraeliCorporationsRegistryClient();

    const first = await client.getCorporationByNumber('516232675');
    await expect(client.getCorporationByNumber('516232675')).resolves.toEqual(first);
    await expect(client.getCorporationByNumber('516232676')).resolves.toBeNull();
    await expect(client.getCorporationByNumber('516232676')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws on an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(
      new IsraeliCorporationsRegistryClient().getCorporationByNumber('516232675'),
    ).rejects.toThrow(/responded with 503/);
  });

  it('throws on a non-JSON body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>blocked</html>', { status: 200 })),
    );
    await expect(
      new IsraeliCorporationsRegistryClient().getCorporationByNumber('516232675'),
    ).rejects.toThrow(/non-JSON response/);
  });

  it('wraps network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(
      new IsraeliCorporationsRegistryClient().getCorporationByNumber('516232675'),
    ).rejects.toThrow(/Failed searching the Israeli corporations registry/);
  });
});
