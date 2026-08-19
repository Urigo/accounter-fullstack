import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleDriveProvider } from '../../app-providers/google-drive/google-drive.provider.js';
import {
  assertFetchableUrl,
  fetchRemoteDocument,
  isBlockedIp,
  MAX_REMOTE_DOCUMENT_BYTES,
  RemoteDocumentError,
} from './fetch-remote-document.helper.js';

/**
 * These tests are about refusals. A server that fetches caller-supplied URLs is
 * an SSRF primitive unless every one of them holds, and the redirect cases are
 * the ones that are easy to get wrong: validating only the submitted URL leaves
 * the whole guard bypassable by a public host that answers with a `Location`
 * pointing inside the network.
 */

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

afterEach(() => {
  vi.unstubAllGlobals();
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
