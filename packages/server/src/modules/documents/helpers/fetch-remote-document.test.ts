import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleDriveProvider } from '../../app-providers/google-drive/google-drive.provider.js';
import {
  assertFetchableUrl,
  assertResolvesToPublicAddress,
  FETCH_TIMEOUT_MS,
  fetchRemoteDocument,
  isBlockedIp,
  MAX_REMOTE_DOCUMENT_BYTES,
  RemoteDocumentError,
  sniffDocumentType,
} from './fetch-remote-document.helper.js';

/**
 * These tests are about refusals. A server that fetches caller-supplied URLs is
 * an SSRF primitive unless every one of them holds, and the redirect cases are
 * the ones that are easy to get wrong: validating only the submitted URL leaves
 * the whole guard bypassable by a public host that answers with a `Location`
 * pointing inside the network.
 */

// Every host is resolved before it is fetched. The tests never touch real DNS:
// each name resolves to a public documentation address unless a test says otherwise.
const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup }));

const PUBLIC_ADDRESS = '203.0.113.10';

/** What `lookup(hostname, { all: true })` resolves to. */
const resolvesTo = (...addresses: string[]) =>
  addresses.map(address => ({ address, family: address.includes(':') ? 6 : 4 }));

const PDF_HEADERS = { 'content-type': 'application/pdf' };

/** A minimal stand-in for `Response`, enough for the helper's use of it. */
function response(
  init: { status?: number; headers?: Record<string, string>; body?: string } = {},
): Response {
  const status = init.status ?? 200;
  const headers = new Headers(init.headers ?? PDF_HEADERS);
  return {
    status,
    ok: status >= 200 && status < 300,
    headers,
    arrayBuffer: async () => new TextEncoder().encode(init.body ?? '%PDF-1.7 fake').buffer,
  } as unknown as Response;
}

beforeEach(() => {
  lookup.mockReset();
  lookup.mockResolvedValue(resolvesTo(PUBLIC_ADDRESS));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('isBlockedIp', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    // The cloud metadata endpoint — the single most valuable SSRF target.
    '169.254.169.254',
    '0.0.0.0',
    '100.64.0.1',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ])('blocks %s', address => {
    expect(isBlockedIp(address)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700::1111'])('allows %s', address => {
    expect(isBlockedIp(address)).toBe(false);
  });
});

describe('assertFetchableUrl', () => {
  it('refuses the cloud metadata address', () => {
    expect(() => assertFetchableUrl('http://169.254.169.254/latest/meta-data/')).toThrow(
      RemoteDocumentError,
    );
  });

  it('refuses localhost by name as well as by address', () => {
    expect(() => assertFetchableUrl('http://localhost:4000/graphql')).toThrow(RemoteDocumentError);
    expect(() => assertFetchableUrl('http://db.local/file.pdf')).toThrow(RemoteDocumentError);
  });

  it('refuses non-http schemes, which is what makes file:// unreachable', () => {
    expect(() => assertFetchableUrl('file:///etc/passwd')).toThrow(RemoteDocumentError);
    expect(() => assertFetchableUrl('gs://bucket/object')).toThrow(RemoteDocumentError);
  });

  it('accepts an ordinary public https URL', () => {
    expect(assertFetchableUrl('https://example.com/invoice.pdf').hostname).toBe('example.com');
  });
});

describe('fetchRemoteDocument', () => {
  it('returns a File named from the URL, typed from the response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response()),
    );

    const file = await fetchRemoteDocument('https://example.com/docs/invoice-2026.pdf');
    expect(file.name).toBe('invoice-2026.pdf');
    expect(file.type).toBe('application/pdf');
    expect(file.size).toBeGreaterThan(0);
  });

  it('refuses a redirect from a public host into the private network', async () => {
    const fetchMock = vi.fn(async (url: URL) =>
      String(url).includes('example.com')
        ? response({ status: 302, headers: { location: 'http://169.254.169.254/latest/' } })
        : response(),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchRemoteDocument('https://example.com/invoice.pdf')).rejects.toThrow(
      /private or loopback/,
    );
    // The second hop was never attempted.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('follows a redirect between public hosts', async () => {
    const fetchMock = vi.fn(async (url: URL) =>
      String(url).includes('short.example')
        ? response({ status: 301, headers: { location: 'https://files.example.com/a.pdf' } })
        : response(),
    );
    vi.stubGlobal('fetch', fetchMock);

    const file = await fetchRemoteDocument('https://short.example/x');
    expect(file.name).toBe('a.pdf');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up on a redirect loop rather than following it forever', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({ status: 302, headers: { location: 'https://example.com/again' } }),
      ),
    );

    await expect(fetchRemoteDocument('https://example.com/start')).rejects.toThrow(
      /Too many redirects/,
    );
  });

  it('refuses an HTML response to a .pdf URL — the type comes from the response, not the path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({ headers: { 'content-type': 'text/html; charset=utf-8' }, body: '<html>' }),
      ),
    );

    await expect(fetchRemoteDocument('https://example.com/invoice.pdf')).rejects.toThrow(
      /Unsupported content type "text\/html"/,
    );
  });

  it('accepts a PDF served as application/octet-stream, typing it from its bytes', async () => {
    // Stripe's hosted invoice/receipt PDF links answer this way.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({ headers: { 'content-type': 'application/octet-stream' }, body: '%PDF-1.4 x' }),
      ),
    );

    const file = await fetchRemoteDocument('https://pay.example.com/invoice/acct_x/live_y/pdf');
    expect(file.type).toBe('application/pdf');
    expect(file.name).toBe('document.pdf');
  });

  it("names a sniffed file by its type, not by the URL's extension", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({ headers: { 'content-type': 'application/octet-stream' }, body: '%PDF-1.4 x' }),
      ),
    );

    const file = await fetchRemoteDocument('https://example.com/files/invoice.bin');
    expect(file.type).toBe('application/pdf');
    expect(file.name).toBe('invoice.pdf');
  });

  it('accepts a PDF served with no Content-Type at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({
            status: 200,
            ok: true,
            headers: new Headers(),
            arrayBuffer: async () => new TextEncoder().encode('%PDF-1.7 fake').buffer,
          }) as unknown as Response,
      ),
    );

    const file = await fetchRemoteDocument('https://example.com/download?id=1');
    expect(file.type).toBe('application/pdf');
  });

  it('refuses an octet-stream body that is not a PDF or an image', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({
          headers: { 'content-type': 'application/octet-stream' },
          body: '<html>%PDF-1.4</html>',
        }),
      ),
    );

    await expect(fetchRemoteDocument('https://example.com/a.pdf')).rejects.toThrow(
      /Unsupported content type "application\/octet-stream"/,
    );
  });

  it('never sniffs a declared non-generic type — HTML that starts with %PDF is still refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ headers: { 'content-type': 'text/html' }, body: '%PDF-1.4' })),
    );

    await expect(fetchRemoteDocument('https://example.com/a.pdf')).rejects.toThrow(
      /Unsupported content type "text\/html"/,
    );
  });

  it('refuses a body over the size cap even when Content-Length lied', async () => {
    const oversize = new Uint8Array(MAX_REMOTE_DOCUMENT_BYTES + 1);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({
            status: 200,
            ok: true,
            headers: new Headers({ ...PDF_HEADERS, 'content-length': '10' }),
            arrayBuffer: async () => oversize.buffer,
          }) as unknown as Response,
      ),
    );

    await expect(fetchRemoteDocument('https://example.com/big.pdf')).rejects.toThrow(/over the/);
  });

  it('refuses an empty body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ body: '' })),
    );

    await expect(fetchRemoteDocument('https://example.com/a.pdf')).rejects.toThrow(/empty body/);
  });

  it('surfaces an HTTP error rather than storing the error page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ status: 404 })),
    );

    await expect(fetchRemoteDocument('https://example.com/a.pdf')).rejects.toThrow(/HTTP 404/);
  });

  it.each([
    ['only a private address', ['10.0.0.5']],
    ['a public and a private address', [PUBLIC_ADDRESS, '192.168.1.20']],
    ['the IPv6 loopback', ['::1']],
  ])('refuses a name that resolves to %s, before any request', async (_label, addresses) => {
    lookup.mockResolvedValue(resolvesTo(...addresses));
    const fetchMock = vi.fn(async () => response());
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchRemoteDocument('https://files.example.com/a.pdf')).rejects.toThrow(
      /resolves to a private or loopback address: files\.example\.com/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves every redirect target too, not just the submitted URL', async () => {
    lookup.mockImplementation(async (hostname: string) =>
      hostname === 'internal.example.com' ? resolvesTo('10.0.0.5') : resolvesTo(PUBLIC_ADDRESS),
    );
    const fetchMock = vi.fn(async () =>
      response({ status: 302, headers: { location: 'https://internal.example.com/a.pdf' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchRemoteDocument('https://example.com/invoice.pdf')).rejects.toThrow(
      /resolves to a private or loopback address: internal\.example\.com/,
    );
    // The redirect target was never requested.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails closed on a name that does not resolve', async () => {
    lookup.mockRejectedValue(
      Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }),
    );
    const fetchMock = vi.fn(async () => response());
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchRemoteDocument('https://nowhere.example/a.pdf')).rejects.toThrow(
      /Could not resolve host: nowhere\.example/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('holds DNS resolution to the same deadline as the request', async () => {
    vi.useFakeTimers();
    // A resolver that never answers.
    lookup.mockReturnValue(new Promise(() => {}));
    const fetchMock = vi.fn(async () => response());
    vi.stubGlobal('fetch', fetchMock);

    const refused = expect(fetchRemoteDocument('https://stalled.example/a.pdf')).rejects.toThrow(
      /Timed out resolving host: stalled\.example/,
    );
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);
    await refused;
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not resolve a literal public address — assertFetchableUrl already judged it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response()),
    );

    await fetchRemoteDocument(`https://${PUBLIC_ADDRESS}/a.pdf`);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('advertises octet-stream at low priority, since it is accepted', async () => {
    const fetchMock = vi.fn(async (_url: URL, _init?: RequestInit) => response());
    vi.stubGlobal('fetch', fetchMock);

    await fetchRemoteDocument('https://example.com/a.pdf');
    const { Accept } = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(Accept).toMatch(/^application\/pdf, /);
    expect(Accept).toMatch(/, application\/octet-stream;q=0\.1$/);
  });
});

describe('assertResolvesToPublicAddress', () => {
  it('does not start a lookup once the deadline has passed', async () => {
    await expect(
      assertResolvesToPublicAddress(new URL('https://example.com/a.pdf'), AbortSignal.abort()),
    ).rejects.toThrow(/Timed out resolving host: example\.com/);
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe('sniffDocumentType', () => {
  const bytes = (...values: Array<number | string>) =>
    new Uint8Array(
      values.flatMap(value =>
        typeof value === 'string' ? [...value].map(char => char.charCodeAt(0)) : [value],
      ),
    );

  it.each([
    ['application/pdf', bytes('%PDF-1.7')],
    ['image/png', bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a)],
    ['image/jpeg', bytes(0xff, 0xd8, 0xff, 0xe0)],
    ['image/webp', bytes('RIFF', 0, 0, 0, 0, 'WEBP')],
    ['image/tiff', bytes('II', 0x2a, 0x00)],
    ['image/tiff', bytes('MM', 0x00, 0x2a)],
    ['image/heic', bytes(0, 0, 0, 0x18, 'ftypheic')],
    ['image/heif', bytes(0, 0, 0, 0x18, 'ftypmif1')],
  ])('recognizes %s', (expected, input) => {
    expect(sniffDocumentType(input)).toBe(expected);
  });

  it.each([
    ['HTML', bytes('<!doctype html>')],
    ['a PDF marker not at offset 0', bytes(' %PDF-1.7')],
    ['a GIF (not an accepted type)', bytes('GIF89a')],
    ['an empty buffer', bytes()],
  ])('rejects %s', (_label, input) => {
    expect(sniffDocumentType(input)).toBeNull();
  });
});

describe('GoogleDriveProvider.isFileUrl', () => {
  it.each([
    'https://drive.google.com/file/d/1AbC_dEf/view?usp=sharing',
    'https://drive.google.com/open?id=1AbC_dEf',
    'https://drive.google.com/uc?export=download&id=1AbC_dEf',
    'https://docs.google.com/document/d/1AbC_dEf/edit',
  ])('recognizes %s as a Drive file link', url => {
    expect(GoogleDriveProvider.isFileUrl(url)).toBe(true);
  });

  it.each([
    // A folder is the other mutation's job, not a single-file fetch.
    'https://drive.google.com/drive/folders/1AbC_dEf',
    'https://example.com/invoice.pdf',
    'https://drive.google.com.evil.test/file/d/1AbC/view',
    'not a url',
  ])('does not treat %s as a Drive file link', url => {
    expect(GoogleDriveProvider.isFileUrl(url)).toBe(false);
  });
});
