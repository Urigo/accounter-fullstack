import { createHash } from 'node:crypto';
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
}

export type ExtractionFailureReason =
  | typeof IngestReasonCode.NO_DOCUMENTS
  | typeof IngestReasonCode.PARSE_ERROR
  | typeof IngestReasonCode.OVERSIZE_MESSAGE;

export type ExtractionResult =
  | { success: true; senderEvidence: SenderEvidence; documents: ExtractedDocument[] }
  | { success: false; reason: ExtractionFailureReason };

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function extractFromMime(rawMime: Buffer): ExtractionResult {
  if (rawMime.length === 0) {
    return { success: false, reason: IngestReasonCode.PARSE_ERROR };
  }

  if (rawMime.length > MAX_RAW_MIME_BYTES) {
    return { success: false, reason: IngestReasonCode.OVERSIZE_MESSAGE };
  }

  try {
    const { headers, documents } = parseMimePart(rawMime);

    if (documents.length > MAX_ATTACHMENT_COUNT) {
      return { success: false, reason: IngestReasonCode.OVERSIZE_MESSAGE };
    }

    const totalBytes = documents.reduce((sum, d) => sum + d.size, 0);
    if (totalBytes > MAX_EXTRACTED_BYTES) {
      return { success: false, reason: IngestReasonCode.OVERSIZE_MESSAGE };
    }

    if (documents.length === 0) {
      return { success: false, reason: IngestReasonCode.NO_DOCUMENTS };
    }

    return { success: true, senderEvidence: buildSenderEvidence(headers), documents };
  } catch {
    return { success: false, reason: IngestReasonCode.PARSE_ERROR };
  }
}

// ---------------------------------------------------------------------------
// MIME header types
// ---------------------------------------------------------------------------

type Headers = Map<string, string>;

interface ParsedPart {
  headers: Headers;
  documents: ExtractedDocument[];
}

// ---------------------------------------------------------------------------
// Low-level buffer utilities
// ---------------------------------------------------------------------------

/** Find index of a byte pattern in a Buffer. Returns -1 if not found. */
function bufferIndexOf(haystack: Buffer, needle: Buffer, start = 0): number {
  return haystack.indexOf(needle, start);
}

/**
 * Split a raw MIME part buffer into header text and body buffer.
 * Handles both CRLF and bare-LF line endings.
 */
function splitHeaderBody(raw: Buffer): { headerText: string; body: Buffer } {
  const CRLFCRLF = Buffer.from('\r\n\r\n');
  const LFLF = Buffer.from('\n\n');

  const ci = bufferIndexOf(raw, CRLFCRLF);
  const li = bufferIndexOf(raw, LFLF);

  let splitAt: number;
  let offset: number;

  if (ci >= 0 && (li < 0 || ci <= li)) {
    splitAt = ci;
    offset = 4;
  } else if (li >= 0) {
    splitAt = li;
    offset = 2;
  } else {
    // No body separator — treat whole buffer as headers with empty body
    return { headerText: raw.toString('latin1'), body: Buffer.alloc(0) };
  }

  return {
    headerText: raw.slice(0, splitAt).toString('latin1'),
    body: raw.slice(splitAt + offset),
  };
}

// ---------------------------------------------------------------------------
// Header parsing
// ---------------------------------------------------------------------------

function parseHeaders(headerText: string): Headers {
  // Unfold continuation lines (RFC 5322: lines starting with SP/HT are continuations)
  const unfolded = headerText.replace(/\r?\n[ \t]+/g, ' ');
  const headers: Headers = new Map();

  for (const line of unfolded.split(/\r?\n/)) {
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }

  return headers;
}

function h(headers: Headers, name: string): string | undefined {
  return headers.get(name.toLowerCase());
}

// ---------------------------------------------------------------------------
// Content-Type parsing helpers
// ---------------------------------------------------------------------------

function getMediaType(contentType: string): string {
  return (contentType.split(';')[0] ?? '').trim().toLowerCase();
}

function getParam(contentType: string, param: string): string | undefined {
  // Require the param name to be preceded by ';', whitespace, or start-of-string
  // to avoid matching suffixes (e.g. "x-boundary" when looking for "boundary").
  const re = new RegExp(`(?:^|[\\s;])${param}=(?:"([^"]+)"|([^\\s;]+))`, 'i');
  const m = contentType.match(re);
  return m?.[1] ?? m?.[2];
}

function getFilename(headers: Headers): string | undefined {
  const cd = h(headers, 'content-disposition');
  if (cd) {
    const fn = getParam(cd, 'filename');
    if (fn) return fn;
  }
  const ct = h(headers, 'content-type');
  if (ct) {
    const fn = getParam(ct, 'name');
    if (fn) return fn;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Transfer-encoding decode
// ---------------------------------------------------------------------------

function decodeBody(body: Buffer, encoding: string | undefined): Buffer {
  const enc = (encoding ?? '7bit').trim().toLowerCase();
  if (enc === 'base64') {
    // Buffer.from(..., 'base64') already ignores all whitespace, including CRLF line endings.
    return Buffer.from(body.toString('ascii'), 'base64');
  }
  if (enc === 'quoted-printable') {
    return decodeQuotedPrintable(body.toString('latin1'));
  }
  return body; // 7bit, 8bit, binary
}

function decodeQuotedPrintable(text: string): Buffer {
  const decoded = text
    .replace(/=\r?\n/g, '') // soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  return Buffer.from(decoded, 'latin1');
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

function isDocumentPart(headers: Headers): boolean {
  const ct = h(headers, 'content-type');
  if (!ct) return false;
  const mediaType = getMediaType(ct);
  if (DOCUMENT_MIME_TYPES.has(mediaType)) return true;
  // application/octet-stream with a .pdf filename
  if (mediaType === 'application/octet-stream') {
    const filename = getFilename(headers);
    if (filename?.toLowerCase().endsWith('.pdf')) return true;
  }
  return false;
}

function resolvedMimeType(headers: Headers): string {
  const ct = h(headers, 'content-type');
  const mediaType = ct ? getMediaType(ct) : 'application/octet-stream';
  if (mediaType === 'application/octet-stream') {
    const filename = getFilename(headers);
    if (filename?.toLowerCase().endsWith('.pdf')) return 'application/pdf';
  }
  return mediaType;
}

// ---------------------------------------------------------------------------
// Multipart boundary splitting
// ---------------------------------------------------------------------------

function splitMultipartParts(body: Buffer, boundary: string): Buffer[] {
  const delim = Buffer.from(`--${boundary}`);
  const closing = Buffer.from(`--${boundary}--`);
  const parts: Buffer[] = [];

  // RFC 2046 §5.1.1: each boundary must be preceded by a CRLF (or be at
  // position 0). Without this check, boundary strings that appear inside
  // base64 content could be incorrectly treated as delimiters.
  const findBoundary = (start: number): number => {
    let s = start;
    while (s < body.length) {
      const idx = body.indexOf(delim, s);
      if (idx < 0) return -1;
      if (idx === 0 || body[idx - 1] === 0x0a) return idx;
      s = idx + 1;
    }
    return -1;
  };

  // Find the first boundary
  let pos = findBoundary(0);
  if (pos < 0) return parts;

  while (pos < body.length) {
    const delimEnd = pos + delim.length;

    // Peek at what follows the boundary marker
    const peek = body.slice(delimEnd, delimEnd + 2);
    const isClosing =
      body.slice(pos, pos + closing.length).equals(closing) ||
      (peek[0] === 0x2d && peek[1] === 0x2d); // '--'

    if (isClosing) break;

    // Skip past end of the boundary line (CRLF or LF)
    let partStart = delimEnd;
    if (body[partStart] === 0x0d) partStart++;
    if (body[partStart] === 0x0a) partStart++;

    // Find the next boundary occurrence
    const nextDelim = findBoundary(partStart);

    let partEnd: number;
    if (nextDelim < 0) {
      partEnd = body.length;
    } else {
      // Strip trailing CRLF before next boundary
      partEnd = nextDelim;
      if (partEnd > 0 && body[partEnd - 1] === 0x0a) partEnd--;
      if (partEnd > 0 && body[partEnd - 1] === 0x0d) partEnd--;
    }

    if (partEnd > partStart) {
      parts.push(body.slice(partStart, partEnd));
    }

    if (nextDelim < 0) break;
    pos = nextDelim;
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Recursive MIME part parser
// ---------------------------------------------------------------------------

function parseMimePart(raw: Buffer, depth = 0): ParsedPart {
  if (depth > MAX_MIME_DEPTH) {
    throw new Error('Max MIME nesting depth exceeded');
  }

  const { headerText, body } = splitHeaderBody(raw);
  const headers = parseHeaders(headerText);

  const contentType = h(headers, 'content-type') ?? 'text/plain';
  const mediaType = getMediaType(contentType);

  const documents: ExtractedDocument[] = [];

  if (mediaType.startsWith('multipart/')) {
    const boundary = getParam(contentType, 'boundary');
    if (!boundary) throw new Error('multipart without boundary');

    const subParts = splitMultipartParts(body, boundary);
    for (const part of subParts) {
      const sub = parseMimePart(part, depth + 1);
      documents.push(...sub.documents);
    }
  } else if (isDocumentPart(headers)) {
    const encoding = h(headers, 'content-transfer-encoding');
    const content = decodeBody(body, encoding);
    const mimeType = resolvedMimeType(headers);
    const sha256 = createHash('sha256').update(content).digest('hex');

    documents.push({
      filename: getFilename(headers),
      mimeType,
      content,
      size: content.length,
      sha256,
    });
  }

  return { headers, documents };
}

// ---------------------------------------------------------------------------
// Sender evidence extraction
// ---------------------------------------------------------------------------

function buildSenderEvidence(headers: Headers): SenderEvidence {
  return {
    from: h(headers, 'from'),
    replyTo: h(headers, 'reply-to'),
    originalFrom: h(headers, 'x-original-from') ?? h(headers, 'x-original-sender'),
    forwardedTo: h(headers, 'x-forwarded-to') ?? h(headers, 'envelope-to'),
  };
}
