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
