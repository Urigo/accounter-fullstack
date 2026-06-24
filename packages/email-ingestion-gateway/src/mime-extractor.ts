import { createHash } from 'node:crypto';
import PostalMime, { type Address } from 'postal-mime';
import { IngestReasonCode } from './contracts.js';

export const MAX_RAW_MIME_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_ATTACHMENT_COUNT = 10;
export const MAX_EXTRACTED_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_MIME_DEPTH = 10;

export interface ExtractedDocument {
  filename: string | undefined;
  mimeType: string;
  content: Buffer;
  size: number;
  sha256: string;
}

export interface SenderEvidence {
  from: string | undefined;
  replyTo: string | undefined;
  /** X-Original-From or X-Original-Sender */
  originalFrom: string | undefined;
  /** X-Forwarded-To or Envelope-To */
  forwardedTo: string | undefined;
  /**
   * Addresses parsed from `From: <mailto:…>` links in the (HTML) body, in
   * document order. The server applies the issuer-selection policy over these
   * plus the header fields.
   */
  issuerCandidates: string[];
}

// NO_DOCUMENTS is intentionally not an extraction failure: an email with no
// attachment may still yield a document during gateway treatment (body→PDF,
// internal-link fetch). Emptiness is decided after treatment, with the server
// ingest as the final backstop.
export type ExtractionFailureReason =
  | typeof IngestReasonCode.PARSE_ERROR
  | typeof IngestReasonCode.OVERSIZE_MESSAGE;

export type ExtractionResult =
  | {
      success: true;
      /** Subject header (RFC 2047-decoded), used for the human-readable charge description. */
      subject: string | undefined;
      senderEvidence: SenderEvidence;
      /** Decoded email body (HTML preferred, else plain text), for downstream treatment. */
      body: string;
      documents: ExtractedDocument[];
    }
  | { success: false; reason: ExtractionFailureReason };

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Parse a raw MIME message into the document set + sender evidence the ingest
 * pipeline needs. Backed by `postal-mime`, which handles the fiddly parts of
 * MIME correctly — RFC 2047 encoded-word headers (so non-ASCII subjects/senders,
 * e.g. Hebrew, decode properly), nested multiparts, transfer-encodings, and
 * per-part charsets. This module keeps only the domain-specific policy on top:
 * which attachments count as "documents", the size/count guards, and the
 * forwarded-sender (`From: <mailto:>`) issuer-candidate heuristic.
 */
export async function extractFromMime(rawMime: Buffer): Promise<ExtractionResult> {
  if (rawMime.length === 0) {
    return { success: false, reason: IngestReasonCode.PARSE_ERROR };
  }

  if (rawMime.length > MAX_RAW_MIME_BYTES) {
    return { success: false, reason: IngestReasonCode.OVERSIZE_MESSAGE };
  }

  let email: Awaited<ReturnType<typeof PostalMime.parse>>;
  try {
    // maxNestingDepth caps pathological/maliciously nested messages; postal-mime
    // throws when it is exceeded, which we map to PARSE_ERROR below.
    email = await PostalMime.parse(rawMime, { maxNestingDepth: MAX_MIME_DEPTH });
  } catch {
    return { success: false, reason: IngestReasonCode.PARSE_ERROR };
  }

  const documents: ExtractedDocument[] = [];
  for (const attachment of email.attachments ?? []) {
    if (!isDocumentAttachment(attachment.mimeType, attachment.filename)) {
      continue;
    }
    const content = toBuffer(attachment.content);
    documents.push({
      filename: attachment.filename ?? undefined,
      mimeType: resolvedMimeType(attachment.mimeType, attachment.filename),
      content,
      size: content.length,
      sha256: createHash('sha256').update(content).digest('hex'),
    });
  }

  if (documents.length > MAX_ATTACHMENT_COUNT) {
    return { success: false, reason: IngestReasonCode.OVERSIZE_MESSAGE };
  }

  const totalBytes = documents.reduce((sum, d) => sum + d.size, 0);
  if (totalBytes > MAX_EXTRACTED_BYTES) {
    return { success: false, reason: IngestReasonCode.OVERSIZE_MESSAGE };
  }

  // Prefer the HTML body (richer, carries mailto links); fall back to plain text.
  const body = email.html ?? email.text ?? '';

  return {
    success: true,
    subject: email.subject,
    body,
    senderEvidence: {
      from: formatAddress(email.from),
      replyTo: formatAddress(email.replyTo?.[0]),
      originalFrom: headerValue(email.headers, 'x-original-from', 'x-original-sender'),
      forwardedTo: headerValue(email.headers, 'x-forwarded-to', 'envelope-to'),
      issuerCandidates: extractIssuerCandidates(body),
    },
    documents,
  };
}

// ---------------------------------------------------------------------------
// Document type detection
// ---------------------------------------------------------------------------

const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/tiff',
  'image/bmp',
  'image/webp',
]);

function isDocumentAttachment(mimeType: string, filename: string | null): boolean {
  const mediaType = mimeType.toLowerCase();
  if (DOCUMENT_MIME_TYPES.has(mediaType)) return true;
  // application/octet-stream with a .pdf filename
  if (mediaType === 'application/octet-stream' && filename?.toLowerCase().endsWith('.pdf')) {
    return true;
  }
  return false;
}

function resolvedMimeType(mimeType: string, filename: string | null): string {
  const mediaType = mimeType.toLowerCase();
  if (mediaType === 'application/octet-stream' && filename?.toLowerCase().endsWith('.pdf')) {
    return 'application/pdf';
  }
  return mediaType;
}

// ---------------------------------------------------------------------------
// Header / address helpers
// ---------------------------------------------------------------------------

function toBuffer(content: ArrayBuffer | Uint8Array | string): Buffer {
  if (typeof content === 'string') return Buffer.from(content);
  if (content instanceof Uint8Array) return Buffer.from(content);
  return Buffer.from(new Uint8Array(content));
}

/** Render a parsed address as `Name <addr>` (or just the address / display name). */
function formatAddress(addr: Address | undefined): string | undefined {
  if (!addr) return undefined;
  const name = addr.name?.trim();
  const address = addr.address?.trim();
  if (name && address) return `${name} <${address}>`;
  return address || name || undefined;
}

/** First non-empty value among the given (case-insensitive) header names. */
function headerValue(
  headers: Array<{ key: string; value: string }>,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const lower = name.toLowerCase();
    const found = headers.find(header => header.key.toLowerCase() === lower);
    if (found?.value) return found.value;
  }
  return undefined;
}

// Forwarded emails often carry the real sender as a `From: … <a href="mailto:…">`
// span in the body. Collect those addresses (decoded), in document order, for
// the server's issuer-selection policy. The bounded lazy quantifier keeps the
// match span small: it tolerates a newline-wrapped `From:` line, avoids matching
// an unrelated mailto far down a minified single-line body, and bounds regex
// backtracking on very large bodies.
const ISSUER_MAILTO_RE = /From:[\s\S]{0,250}?<a\s+href="mailto:([^"]+)"/gi;

function extractIssuerCandidates(body: string): string[] {
  const candidates: string[] = [];
  for (const match of body.matchAll(ISSUER_MAILTO_RE)) {
    let email = match[1];
    try {
      email = decodeURIComponent(email);
    } catch {
      // keep the raw value if it is not valid percent-encoding
    }
    candidates.push(email);
  }
  return candidates;
}
