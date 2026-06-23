import { createHash } from 'node:crypto';
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
  const re = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"/gi;
  for (const match of body.matchAll(re)) {
    const urlString = match[1];
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
  if (
    host === '::1' ||
    host.startsWith('fe80:') ||
    host.startsWith('fc') ||
    host.startsWith('fd')
  ) {
    return true;
  }
  return false;
}

/**
 * Fetch a document referenced by a configured internal link in the email body
 * (ported from legacy `innerLinkDocumentFetcher`). Some provider emails carry
 * the document only as a URL — a post-recognition treatment artifact.
 *
 * SSRF hardening: the host/path allowlist (via {@link getLinkFromBody}), a
 * private/loopback host block, http(s)-only, redirects disabled, a content-type
 * allowlist, and a response size cap.
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

  const buf = Buffer.from(await response.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_FETCH_BYTES) {
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
