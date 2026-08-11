import { createHash } from 'node:crypto';
import PostalMime, { decodeWords, type Address } from 'postal-mime';
import { IngestReasonCode } from './contracts.js';
import { parseForwardedBlocks, type ForwardedBlock } from './forwarded.js';

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

/**
 * Structural facts about who sent the message and how it reached the tenant.
 *
 * Everything here is derived from the MIME message alone — the gateway has no tenant
 * knowledge. Deciding which of these addresses identifies the issuing business, and
 * which belong to the tenant itself, is the server's `classifyEmail` policy.
 */
export interface SenderEvidence {
  from: string | undefined;
  /** From display name, RFC 2047-decoded. Names the issuer when the address does not. */
  fromDisplayName: string | undefined;
  replyTo: string | undefined;
  /** X-Original-From */
  originalFrom: string | undefined;
  /** X-Original-Sender — the relaying platform, when the message came through one. */
  originalSender: string | undefined;
  /** X-Forwarded-To or Envelope-To */
  forwardedTo: string | undefined;
  /** List-ID / Mailing-list marker, set when the message came through a mailing list. */
  listId: string | undefined;
  /** Addresses identifying the mailing list itself, from List-Post / Mailing-list. */
  listAddresses: string[];
  /** Quoted forwarded-header blocks recovered from the body, outermost first. */
  forwardedBlocks: ForwardedBlock[];
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
  typeof IngestReasonCode.PARSE_ERROR | typeof IngestReasonCode.OVERSIZE_MESSAGE;

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
      fromDisplayName: email.from?.name?.trim() || undefined,
      replyTo: formatAddress(email.replyTo?.[0]),
      // Kept as separate fields: X-Original-From is the original *author* (often a
      // display name only), X-Original-Sender the relaying platform. Reading them as
      // one "first non-empty" value let the author shadow the platform, losing the
      // single most reliable signal that a message came through an invoice provider.
      originalFrom: headerValue(email.headers, 'x-original-from'),
      originalSender: headerValue(email.headers, 'x-original-sender'),
      forwardedTo: headerValue(email.headers, 'x-forwarded-to', 'envelope-to'),
      listId: headerValue(email.headers, 'list-id', 'mailing-list', 'x-google-group-id'),
      listAddresses: extractListAddresses(email.headers),
      // Parse both parts: the text alternative carries the cleanest forwarded block,
      // but plenty of forwards are HTML-only.
      forwardedBlocks: parseForwardedBlocks(email.text ?? '', email.html ?? ''),
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

/**
 * First non-empty value among the given (case-insensitive) header names, RFC
 * 2047-decoded so a non-ASCII display name is readable rather than an encoded-word.
 */
function headerValue(
  headers: Array<{ key: string; value: string }>,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const lower = name.toLowerCase();
    const found = headers.find(header => header.key.toLowerCase() === lower);
    if (found?.value) {
      try {
        return decodeWords(found.value);
      } catch {
        return found.value;
      }
    }
  }
  return undefined;
}

// A mailing list identifies itself across several headers, none of which is
// guaranteed: `Mailing-list: list <addr>; contact <addr>`, `List-Post: <mailto:addr>`,
// `List-ID: <name.domain>`. Collecting the addresses lets the server exclude the
// tenant's own group from issuer candidacy structurally — without it, a list rewrite
// of `From` looks like an ordinary external sender.
// Deliberately excludes Delivered-To: that is the recipient's own mailbox, not the
// list. Treating it as a list address would make a person's manual forward look like
// a relay and stop the forwarder being recognized as one.
const LIST_HEADER_NAMES = ['list-post', 'list-id', 'mailing-list'];
const ADDRESS_IN_HEADER_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function extractListAddresses(headers: Array<{ key: string; value: string }>): string[] {
  const found = new Set<string>();
  for (const header of headers) {
    if (!LIST_HEADER_NAMES.includes(header.key.toLowerCase())) {
      continue;
    }
    for (const match of header.value.matchAll(ADDRESS_IN_HEADER_RE)) {
      found.add(match[0].toLowerCase());
    }
  }
  return [...found];
}

// Forwarded mail carries the real issuer inside a quoted header block — the
// original `From:` / `Reply-To:` / `Sender:` lines — because a manual Gmail
// forward rewrites the live `From`, drops the original `Reply-To`, and doesn't
// set `X-Original-From`. We recover those addresses from the body so the
// server's issuer-selection policy can still match them. For each header label
// we take the first address that follows, accepting both a `<a href="mailto:…">`
// link (group 1, percent-decoded) and a plain/angle-bracketed (`<addr>` or bare
// `addr`) form (group 2). The bounded lazy quantifier keeps each match span
// small: it tolerates a newline-wrapped label, avoids reaching an unrelated
// address far down a minified single-line body, and bounds regex backtracking.
const ISSUER_EMAIL = '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}';
const ISSUER_CANDIDATE_RE = new RegExp(
  `(?:From|Reply-To|Sender):[\\s\\S]{0,250}?(?:href="mailto:([^"?]+)"|(${ISSUER_EMAIL}))`,
  'gi',
);
// Any `mailto:` link anywhere in the body, used as a lower-priority fallback.
// A mailing-list forward ("… via <Group> <group@…>", e.g. a Google Group)
// rewrites the quoted `From:` to the group's own address, so the header-anchored
// regex above only recovers the forwarder — the real issuer survives only as a
// contact/footer link ("If you have questions, contact billing@vendor.com" →
// `<a href="mailto:billing@vendor.com">`). Harvesting those lets the server's
// issuer lookup still match the issuing business. Extra addresses are harmless:
// the server only matches candidates that are registered to a business, and its
// candidate ordering already prefers non-forwarder addresses.
const MAILTO_LINK_RE = /mailto:([^"'?>\s]+)/gi;
const MAX_ISSUER_CANDIDATES = 25;

function extractIssuerCandidates(body: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  // Returns true once the candidate cap is reached, so callers stop scanning.
  const add = (raw: string, percentDecode: boolean): boolean => {
    let email = raw;
    if (percentDecode) {
      try {
        email = decodeURIComponent(email);
      } catch {
        // keep the raw value if it is not valid percent-encoding
      }
    }
    email = email.trim();
    const key = email.toLowerCase();
    if (email && !seen.has(key)) {
      seen.add(key);
      candidates.push(email);
    }
    return candidates.length >= MAX_ISSUER_CANDIDATES;
  };

  // 1. Header-anchored addresses from the quoted From/Reply-To/Sender block —
  //    highest signal, kept first so they win in the server's selection policy.
  for (const match of body.matchAll(ISSUER_CANDIDATE_RE)) {
    if (add(match[1] ?? match[2] ?? '', !!match[1])) {
      return candidates;
    }
  }

  // 2. Any other `mailto:` link in the body (contact/footer addresses) —
  //    lower signal, appended after the header-anchored candidates. Deduped
  //    against them via `seen`, so a link already captured above is not repeated.
  for (const match of body.matchAll(MAILTO_LINK_RE)) {
    if (add(match[1] ?? '', true)) {
      return candidates;
    }
  }

  return candidates;
}
