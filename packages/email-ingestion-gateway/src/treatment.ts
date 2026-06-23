import { renderHtmlToPdf } from './html-to-pdf.js';
import { fetchInternalLinkDocuments } from './link-fetcher.js';
import { log } from './logger.js';
import type { ExtractedDocument } from './mime-extractor.js';
import type { BusinessEmailConfig } from './server-client.js';

export interface TreatmentInput {
  /** Recognized business config from control; null when no business matched. */
  config: BusinessEmailConfig | null;
  /** Decoded email body (HTML preferred), from MIME extraction. */
  body: string;
  /** Raw attachment documents extracted from the MIME message. */
  attachments: ExtractedDocument[];
  correlationId?: string;
}

/** Injectable I/O so the assembly logic is testable without Chromium / network. */
export interface TreatmentDeps {
  renderHtmlToPdf: (html: string) => Promise<ExtractedDocument>;
  fetchInternalLinkDocuments: (body: string, pattern: string) => Promise<ExtractedDocument[]>;
}

const defaultDeps: TreatmentDeps = { renderHtmlToPdf, fetchInternalLinkDocuments };

/** Map a document's MIME type to the EmailAttachmentType label used in config. */
function attachmentType(mimeType: string): string | null {
  switch (mimeType.toLowerCase()) {
    case 'application/pdf':
      return 'PDF';
    case 'image/png':
      return 'PNG';
    case 'image/jpeg':
    case 'image/jpg':
      return 'JPEG';
    default:
      return null;
  }
}

/**
 * Build the final document set from the recognized business config plus the
 * email body and raw attachments — the gateway treatment step (ported from the
 * legacy gmail-listener `handleMessage`):
 *
 *  1. keep attachments allowed by `config.attachments` (all, when unset);
 *  2. render the body to a PDF when no business is recognized **or**
 *     `config.emailBody === true`;
 *  3. fetch documents from each configured `config.internalEmailLinks` pattern
 *     found in the body.
 *
 * Emptiness is decided by the caller from the returned set (with the server
 * ingest as the final NO_DOCUMENTS backstop).
 */
export async function applyTreatment(
  input: TreatmentInput,
  deps: TreatmentDeps = defaultDeps,
): Promise<ExtractedDocument[]> {
  const { config, body, attachments, correlationId } = input;
  const out: ExtractedDocument[] = [];

  // 1. Attachment filter — keep all when the business sets no allowlist.
  // Normalize to upper-case so the comparison stays robust even though the
  // EmailAttachmentType enum (PDF/PNG/JPEG) is already upper-case on the wire.
  const allowed = config?.attachments ? config.attachments.map(a => a.toUpperCase()) : null;
  for (const doc of attachments) {
    if (allowed && !allowed.includes(attachmentType(doc.mimeType) ?? '')) {
      continue;
    }
    out.push(doc);
  }

  // 2. Body → PDF when there is no recognized business, or it opts in.
  if ((!config?.businessId || config.emailBody === true) && body.trim().length > 0) {
    try {
      out.push(await deps.renderHtmlToPdf(body));
    } catch (err) {
      log('warn', 'treatment: body→PDF render failed', { error: String(err) }, correlationId);
    }
  }

  // 3. Documents behind configured internal links in the body.
  for (const link of config?.internalEmailLinks ?? []) {
    try {
      out.push(...(await deps.fetchInternalLinkDocuments(body, link)));
    } catch (err) {
      log(
        'warn',
        'treatment: internal-link fetch failed',
        { link, error: String(err) },
        correlationId,
      );
    }
  }

  return out;
}
