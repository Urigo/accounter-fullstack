import { getDocumentViewerLabels } from '../../../helpers/documents.js';
import type { DocumentViewerEntry, DocumentViewerSource } from './types.js';

/** URL scalars arrive as `string | URL`. Trimmed; an empty value is `null`. */
export function toUrlString(v: string | URL | null | undefined): string | null {
  if (v == null) {
    return null;
  }
  const value = v.toString().trim();
  return value === '' ? null : value;
}

export function toDocumentViewerEntry(
  doc: { id: string; image?: string | URL | null; file?: string | URL | null } & Parameters<
    typeof getDocumentViewerLabels
  >[0],
): DocumentViewerEntry {
  return {
    id: doc.id,
    imageUrl: toUrlString(doc.image),
    fileUrl: toUrlString(doc.file),
    ...getDocumentViewerLabels(doc),
  };
}

export function hasViewerAttachment(s: DocumentViewerSource): boolean {
  return !!(s.imageUrl || s.fileUrl);
}

/**
 * Whether a stored URL may be rendered as a link. `image` and `file` are user-editable and the
 * `URL` scalar accepts any scheme, so anything but an absolute http(s) URL — `javascript:` and
 * `data:` included — is refused.
 */
export function isSafeHttpUrl(url: string | null): boolean {
  if (!url) {
    return false;
  }
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** `URL.canParse`, with a `new URL` fallback for browsers that predate it. */
function canParseUrl(value: string): boolean {
  if (typeof URL.canParse === 'function') {
    return URL.canParse(value);
  }
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/** A dotted-quad IPv4 address: four numeric parts. */
const DOTTED_QUAD = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * The host as typed, before `URL` normalizes it: the authority after `scheme://`, without user
 * info or port. `null` when the input has no `//` authority.
 */
function typedHost(url: string): string | null {
  const authority = /^[a-z][a-z\d+.-]*:\/\/([^/?#\\]*)/i.exec(url)?.[1];
  if (authority == null) {
    return null;
  }
  const host = authority.slice(authority.lastIndexOf('@') + 1);
  return host.replace(/:\d*$/, '').toLowerCase();
}

/**
 * Whether the URL's host looks complete: `localhost`, a name with a dot and something on both
 * sides (`example.com`), or an IPv4 address typed as exactly four numeric parts.
 *
 * `URL` normalizes partial IPv4 hosts (`https://10` → `0.0.0.10`, `http://192.168.1` →
 * `192.168.0.1`, `http://127.1` → `127.0.0.1`), so a numeric host is checked against what was
 * typed: a pause while typing `http://192.168.1.50` must not fetch `192.168.0.1`. Not previewed:
 * names still being typed (`exam`, `exam.`), single-label names, trailing-dot hosts and IPv6.
 */
function isCompleteHost(hostname: string, url: string): boolean {
  if (hostname === 'localhost') {
    return true;
  }
  if (/^[\d.]+$/.test(hostname)) {
    const typed = typedHost(url);
    return typed != null && DOTTED_QUAD.test(typed) && typed === hostname;
  }
  return /^[^.]+(\.[^.]+)+$/.test(hostname);
}

/**
 * The image the edit sheet's viewer shows while the Image URL field is being edited: the typed
 * value once it parses as an absolute http(s) URL with a complete hostname, the stored `image`
 * otherwise (empty, half-typed, or another scheme).
 *
 * The hostname check is for privacy as much as tidiness: a preview fetches the URL, and a pause
 * while typing `https://exam` would otherwise send a request to whatever host `exam` resolves to.
 */
export function previewImageUrl(value: unknown, stored: string | null): string | null {
  const url = typeof value === 'string' || value instanceof URL ? toUrlString(value) : null;
  if (!url || !canParseUrl(url)) {
    return stored;
  }
  const { protocol, hostname } = new URL(url);
  if (protocol !== 'http:' && protocol !== 'https:') {
    return stored;
  }
  return isCompleteHost(hostname, url) ? url : stored;
}
