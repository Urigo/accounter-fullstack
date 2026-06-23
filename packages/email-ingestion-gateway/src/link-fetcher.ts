import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { renderHtmlToPdf } from './html-to-pdf.js';
import type { ExtractedDocument } from './mime-extractor.js';

const MAX_FETCH_BYTES = 20 * 1024 * 1024; // align with MAX_EXTRACTED_BYTES
const FETCH_TIMEOUT_MS = 15_000;
const ALLOWED_CONTENT_TYPES = ['application/pdf', 'text/html'];

/**
 * Find the first `<a href>` in the body whose URL matches the configured
 * `internalLink` host + path prefix (ported from legacy `getLinkFromBody`).
 * This host/path allowlist is the primary SSRF control — only links to the
 * configured vendor host/path are eligible to be fetched.
 */
export function getLinkFromBody(body: string, partialUrl: string): string | null {
  let partial: URL;
  try {
    partial = new URL(partialUrl);
  } catch {
    return null;
  }
  // Match href values in double quotes, single quotes, or unquoted — HTML emails
  // use all three. The host/path allowlist below remains the SSRF control, so a
  // broader match only improves coverage of legitimate link formats.
  const re = /<a\s+(?:[^>]*?\s+)?href=(?:"([^"]*)"|'([^']*)'|([^"'\s>]+))/gi;
  for (const match of body.matchAll(re)) {
    const urlString = match[1] ?? match[2] ?? match[3];
    if (!urlString) {
      continue;
    }
    try {
      const full = new URL(urlString);
      const prefix = partial.pathname.endsWith('/') ? partial.pathname : `${partial.pathname}/`;
      if (
        full.hostname === partial.hostname &&
        (full.pathname === partial.pathname || full.pathname.startsWith(prefix))
      ) {
        return urlString;
      }
    } catch {
      // ignore invalid href URLs
    }
  }
  return null;
}

/** Block loopback / private / link-local IP literals (v4, v6, IPv4-mapped v6). */
export function isBlockedIp(ip: string): boolean {
  const host = ip.toLowerCase().replace(/^\[|\]$/g, '');
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31)
    ) {
      return true;
    }
  }
  // IPv6 loopback (::1), link-local (fe80::/10), and unique-local (fc00::/7).
  if (
    host === '::1' ||
    host.startsWith('fe80:') ||
    host.startsWith('fc') ||
    host.startsWith('fd')
  ) {
    return true;
  }
  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) — validate the embedded v4 address.
  const mapped = host.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped && isBlockedIp(mapped[1])) {
    return true;
  }
  return false;
}

/** Block loopback / private / link-local hosts (defense-in-depth against SSRF). */
export function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }
  return isBlockedIp(host);
}

/**
 * Resolve a hostname and block when any resolved address is private/loopback.
 * Defense-in-depth against a public-looking hostname that resolves to an
 * internal IP (which the static {@link isBlockedHost} string check cannot catch)
 * — the host/path allowlist in {@link getLinkFromBody} remains the primary SSRF
 * control. Fails closed: a resolution error is treated as blocked.
 *
 * NOTE: this does not pin the connection to the validated address, so a
 * determined DNS-rebinding attacker could still race the resolution. That
 * residual is bounded by the exact-host allowlist (the host must equal an
 * operator-configured vendor host, not an attacker-chosen one).
 */
async function resolvesToBlockedAddress(hostname: string): Promise<boolean> {
  try {
    const addresses = await lookup(hostname, { all: true });
    return addresses.length === 0 || addresses.some(({ address }) => isBlockedIp(address));
  } catch {
    return true;
  }
}

/** Read a response body into a Buffer, aborting once it exceeds `maxBytes`. */
async function readCappedBody(response: Response, maxBytes: number): Promise<Buffer | null> {
  const reader = response.body?.getReader();
  if (!reader) {
    return null;
  }
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          return null;
        }
        chunks.push(Buffer.from(value));
      }
    }
  } catch {
    return null;
  }
  return Buffer.concat(chunks);
}

/**
 * Fetch a document referenced by a configured internal link in the email body
 * (ported from legacy `innerLinkDocumentFetcher`). Some provider emails carry
 * the document only as a URL — a post-recognition treatment artifact.
 *
 * SSRF hardening: the host/path allowlist (via {@link getLinkFromBody}), a
 * private/loopback host block plus a resolved-IP check, http(s)-only, redirects
 * disabled, a content-type allowlist, and a streamed response size cap.
 */
export async function fetchInternalLinkDocuments(
  body: string,
  internalLink: string,
): Promise<ExtractedDocument[]> {
  const link = getLinkFromBody(body, internalLink);
  if (!link) {
    return [];
  }

  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return [];
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return [];
  }
  if (isBlockedHost(url.hostname)) {
    return [];
  }
  if (await resolvesToBlockedAddress(url.hostname)) {
    return [];
  }

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: 'error', // block redirects — a redirect could bypass the host allowlist
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return [];
  }
  if (!response.ok) {
    return [];
  }

  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.some(type => contentType.includes(type))) {
    return [];
  }
  const declaredLength = Number(response.headers.get('content-length') ?? '0');
  if (declaredLength > MAX_FETCH_BYTES) {
    return [];
  }

  // content-length may be absent (chunked) or spoofed, so it is never trusted on
  // its own — stream the body and abort once the cap is exceeded. This bounds
  // memory and prevents an OOM DoS from an oversized (or lying) response.
  const buf = await readCappedBody(response, MAX_FETCH_BYTES);
  if (!buf || buf.length === 0) {
    return [];
  }

  if (contentType.includes('text/html')) {
    const pdf = await renderHtmlToPdf(buf.toString('utf8')).catch(() => null);
    return pdf ? [{ ...pdf, filename: 'external.pdf' }] : [];
  }

  // application/pdf
  return [
    {
      filename: 'external.pdf',
      mimeType: 'application/pdf',
      content: buf,
      size: buf.length,
      sha256: createHash('sha256').update(buf).digest('hex'),
    },
  ];
}
