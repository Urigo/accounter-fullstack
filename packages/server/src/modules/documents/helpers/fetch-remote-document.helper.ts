import { isIP } from 'node:net';

/**
 * Fetch a document from a caller-supplied URL, safely.
 *
 * A server that fetches arbitrary URLs on request is an SSRF primitive: it sits
 * inside the private network and will happily read the cloud metadata endpoint,
 * an internal admin panel, or `localhost` on behalf of whoever asked. Every
 * guard below exists for that reason, and each one is re-applied **after every
 * redirect** — checking only the submitted URL is the classic way this goes
 * wrong, since the attacker controls the redirect target too.
 *
 * Google Drive share links are *not* handled here; they are not download links
 * (`/file/d/<id>/view` answers with an HTML page) and need the Drive API. The
 * resolver routes those to `GoogleDriveProvider` before reaching this helper.
 */

/** Max bytes accepted from a remote document. */
export const MAX_REMOTE_DOCUMENT_BYTES = 25 * 1024 * 1024;
/** Max redirects followed before giving up. */
export const MAX_REDIRECTS = 5;
/** Wall-clock budget for one document fetch, including redirects. */
export const FETCH_TIMEOUT_MS = 30_000;

/**
 * Accepted content types, matched against the *response's* `Content-Type` — not
 * the URL's extension and not anything the caller claims. A `.pdf` URL that
 * answers with `text/html` is a login page or an error, and storing it would
 * file a web page as a financial record.
 */
export const ALLOWED_REMOTE_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/tiff',
]);

/**
 * Content types that say nothing about the file. Some hosts serve real
 * documents this way — Stripe's hosted invoice and receipt PDF links answer with
 * `application/octet-stream` — so for these, and only these, the type is taken
 * from the file's leading bytes instead (see {@link sniffDocumentType}). A
 * *declared* type outside the allowlist, `text/html` above all, is still refused
 * without looking at the body.
 */
export const GENERIC_REMOTE_MIME_TYPES = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
  'application/binary',
  'application/download',
  'application/x-download',
  'application/force-download',
]);

/**
 * Identify a document from its magic bytes, returning one of
 * {@link ALLOWED_REMOTE_MIME_TYPES} or `null`.
 *
 * Deliberately narrow: only signatures that open the file at offset 0 (or, for
 * the ISO-BMFF HEIC container, its fixed `ftyp` box) count, so an HTML page that
 * happens to mention `%PDF` somewhere is not a PDF.
 */
export function sniffDocumentType(bytes: Uint8Array): string | null {
  const startsWith = (signature: number[], offset = 0) =>
    bytes.length >= offset + signature.length &&
    signature.every((byte, index) => bytes[offset + index] === byte);
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length));

  if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'; // %PDF-
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  if (startsWith([0x49, 0x49, 0x2a, 0x00]) || startsWith([0x4d, 0x4d, 0x00, 0x2a])) {
    return 'image/tiff';
  }
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4);
    if (['heic', 'heix', 'hevc', 'hevx'].includes(brand)) return 'image/heic';
    if (['mif1', 'msf1', 'heif'].includes(brand)) return 'image/heif';
  }
  return null;
}

/** Thrown for every refusal here, so the resolver can report it per URL. */
export class RemoteDocumentError extends Error {}

/**
 * Whether a literal IP address belongs to a range that must never be reachable
 * through this helper: loopback, private, link-local (which includes the cloud
 * metadata address 169.254.169.254), carrier-grade NAT, and the IPv6
 * equivalents.
 */
export function isBlockedIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const octets = address.split('.').map(Number);
    const [a, b] = octets as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (version === 6) {
    const lower = address.toLowerCase().replace(/^\[|\]$/g, '');
    if (lower === '::' || lower === '::1') return true;
    // Unique-local (fc00::/7) and link-local (fe80::/10).
    if (/^f[cd]/.test(lower) || /^fe[89ab]/.test(lower)) return true;
    // IPv4-mapped (::ffff:127.0.0.1) — recurse on the embedded address.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isBlockedIp(mapped[1]);
    return false;
  }
  return false;
}

/**
 * Reject a URL before it is fetched. Applied to the submitted URL and again to
 * every redirect target.
 *
 * Hostnames that are not literal IPs are checked by name only. Resolving them
 * here would not close the DNS-rebinding gap either (the name is resolved again
 * by `fetch`), so the meaningful guard is the response-side one: a redirect to
 * an internal host still has to pass this check, and the content-type check
 * rejects whatever an internal service would answer with.
 */
export function assertFetchableUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new RemoteDocumentError(`Not a valid URL: "${rawUrl}"`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new RemoteDocumentError(
      `Unsupported URL scheme "${url.protocol}" — only http and https are fetched`,
    );
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname) && isBlockedIp(hostname)) {
    throw new RemoteDocumentError(`Refusing to fetch a private or loopback address: ${hostname}`);
  }
  const lowerHost = hostname.toLowerCase();
  if (
    lowerHost === 'localhost' ||
    lowerHost.endsWith('.localhost') ||
    lowerHost.endsWith('.local')
  ) {
    throw new RemoteDocumentError(`Refusing to fetch a local address: ${hostname}`);
  }

  return url;
}

function unsupportedContentType(contentType: string): RemoteDocumentError {
  return new RemoteDocumentError(
    `Unsupported content type "${contentType || 'unknown'}" — expected a PDF or an image. ` +
      `A share link that renders a web page will land here; use a direct download link.`,
  );
}

/** Best-effort filename: the last path segment, else a generic one. */
function filenameFromUrl(url: URL, contentType: string): string {
  const segment = decodeURIComponent(url.pathname.split('/').findLast(Boolean) ?? '');
  if (segment && /\.[a-z0-9]{2,5}$/i.test(segment)) {
    return segment;
  }
  const extension = contentType === 'application/pdf' ? 'pdf' : contentType.split('/')[1];
  return `document.${extension || 'bin'}`;
}

/**
 * Fetch one document. Redirects are followed manually so each hop can be
 * re-validated; `fetch`'s own `redirect: 'follow'` would hide the intermediate
 * targets and defeat {@link assertFetchableUrl}.
 */
export async function fetchRemoteDocument(rawUrl: string): Promise<File> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let url = assertFetchableUrl(rawUrl);
    let response: Response | undefined;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      response = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { Accept: [...ALLOWED_REMOTE_MIME_TYPES].join(', ') },
      }).catch(error => {
        throw new RemoteDocumentError(
          `Failed fetching document: ${error instanceof Error ? error.message : String(error)}`,
        );
      });

      if (response.status < 300 || response.status >= 400) {
        break;
      }
      const location = response.headers.get('location');
      if (!location) {
        throw new RemoteDocumentError(
          `Redirect with no Location header (status ${response.status})`,
        );
      }
      // Re-validating here is the point of the manual loop.
      url = assertFetchableUrl(new URL(location, url).toString());
      response = undefined;
    }

    if (!response) {
      throw new RemoteDocumentError(`Too many redirects (over ${MAX_REDIRECTS})`);
    }
    if (!response.ok) {
      throw new RemoteDocumentError(`Document URL returned HTTP ${response.status}`);
    }

    const contentType = (response.headers.get('content-type') ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const isGenericType = GENERIC_REMOTE_MIME_TYPES.has(contentType);
    if (!isGenericType && !ALLOWED_REMOTE_MIME_TYPES.has(contentType)) {
      throw unsupportedContentType(contentType);
    }

    // Trust the declared length only to fail early; the real check is on the
    // bytes actually received, since the header is attacker-controlled.
    const declared = Number(response.headers.get('content-length') ?? Number.NaN);
    if (Number.isFinite(declared) && declared > MAX_REMOTE_DOCUMENT_BYTES) {
      throw new RemoteDocumentError(
        `Document is ${Math.round(declared / 1024 / 1024)}MB, over the ` +
          `${MAX_REMOTE_DOCUMENT_BYTES / 1024 / 1024}MB limit`,
      );
    }

    const buffer = await response.arrayBuffer().catch(error => {
      throw new RemoteDocumentError(
        `Failed reading document body: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    if (buffer.byteLength === 0) {
      throw new RemoteDocumentError('Document URL returned an empty body');
    }
    if (buffer.byteLength > MAX_REMOTE_DOCUMENT_BYTES) {
      throw new RemoteDocumentError(
        `Document is ${Math.round(buffer.byteLength / 1024 / 1024)}MB, over the ` +
          `${MAX_REMOTE_DOCUMENT_BYTES / 1024 / 1024}MB limit`,
      );
    }

    // A generic declared type is resolved from the bytes, never trusted as-is:
    // whatever the sniffer cannot place as a PDF or an image is refused exactly
    // as a declared `text/html` would have been.
    let documentType = contentType;
    if (isGenericType) {
      const sniffed = sniffDocumentType(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 16)));
      if (!sniffed) {
        throw unsupportedContentType(contentType);
      }
      documentType = sniffed;
    }

    return new File([buffer], filenameFromUrl(url, documentType), { type: documentType });
  } finally {
    clearTimeout(timeout);
  }
}
