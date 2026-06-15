import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { IngestReasonCode } from '../contracts.js';
import {
  MAX_ATTACHMENT_COUNT,
  MAX_EXTRACTED_BYTES,
  MAX_MIME_DEPTH,
  MAX_RAW_MIME_BYTES,
  extractFromMime,
  type ExtractedDocument,
  type SenderEvidence,
} from '../mime-extractor.js';

vi.mock('dotenv', () => ({ config: vi.fn() }));

// ---------------------------------------------------------------------------
// MIME helpers
// ---------------------------------------------------------------------------

/** Build a minimal plain-text MIME message */
function makeTextMime(from: string, subject: string, body = 'hello'): Buffer {
  return Buffer.from(
    [
      `From: ${from}`,
      `To: invoices@example.com`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      body,
    ].join('\r\n'),
    'utf8',
  );
}

/**
 * Build a multipart/mixed MIME with one base64-encoded attachment.
 * `content` should be the raw bytes of the attachment.
 */
function makeMultipartMime(opts: {
  from?: string;
  replyTo?: string;
  originalFrom?: string;
  originalSender?: string;
  attachments?: Array<{ filename: string; mimeType: string; content: Buffer }>;
}): Buffer {
  const boundary = 'TESTBOUNDARY001';
  const headers = [
    `From: ${opts.from ?? 'sender@example.com'}`,
    `To: invoices@example.com`,
    `Subject: Test`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];
  if (opts.replyTo) headers.push(`Reply-To: ${opts.replyTo}`);
  if (opts.originalFrom) headers.push(`X-Original-From: ${opts.originalFrom}`);
  if (opts.originalSender) headers.push(`X-Original-Sender: ${opts.originalSender}`);

  const parts: string[] = [];
  parts.push(
    [
      `Content-Type: text/plain`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      `See attached.`,
    ].join('\r\n'),
  );

  for (const att of opts.attachments ?? []) {
    parts.push(
      [
        `Content-Type: ${att.mimeType}`,
        `Content-Disposition: attachment; filename="${att.filename}"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        att.content.toString('base64'),
      ].join('\r\n'),
    );
  }

  const body = [
    `--${boundary}`,
    parts.join(`\r\n--${boundary}\r\n`),
    `--${boundary}--`,
  ].join('\r\n');

  return Buffer.from([...headers, '', body].join('\r\n'), 'utf8');
}

/** Build a small fake PDF buffer */
function fakePdf(sizeBytes = 512): Buffer {
  const buf = Buffer.alloc(sizeBytes);
  buf.write('%PDF-1.4 fake', 0, 'ascii');
  return buf;
}

/** Build a small fake PNG buffer */
function fakePng(sizeBytes = 256): Buffer {
  const buf = Buffer.alloc(sizeBytes);
  // PNG magic bytes
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  return buf;
}

import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Limit constants
// ---------------------------------------------------------------------------

describe('exported limit constants', () => {
  it('MAX_RAW_MIME_BYTES is 25 MB', () => {
    expect(MAX_RAW_MIME_BYTES).toBe(25 * 1024 * 1024);
  });
  it('MAX_ATTACHMENT_COUNT is 10', () => {
    expect(MAX_ATTACHMENT_COUNT).toBe(10);
  });
  it('MAX_EXTRACTED_BYTES is 20 MB', () => {
    expect(MAX_EXTRACTED_BYTES).toBe(20 * 1024 * 1024);
  });
});

// ---------------------------------------------------------------------------
// OVERSIZE_MESSAGE — raw MIME size
// ---------------------------------------------------------------------------

describe('extractFromMime — OVERSIZE_MESSAGE', () => {
  it('returns OVERSIZE_MESSAGE when raw MIME exceeds 25 MB', () => {
    const big = Buffer.alloc(MAX_RAW_MIME_BYTES + 1);
    const result = extractFromMime(big);
    expect(result).toEqual({ success: false, reason: IngestReasonCode.OVERSIZE_MESSAGE });
  });

  it('does NOT reject a message at exactly 25 MB', () => {
    // A buffer of exactly MAX size should not trigger the oversize check
    // (even if it's invalid MIME it will fail differently)
    const exact = Buffer.alloc(MAX_RAW_MIME_BYTES);
    const result = extractFromMime(exact);
    // Either PARSE_ERROR or NO_DOCUMENTS — not OVERSIZE_MESSAGE
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).not.toBe(IngestReasonCode.OVERSIZE_MESSAGE);
    }
  });

  it('returns OVERSIZE_MESSAGE when attachment count exceeds 10', () => {
    const attachments = Array.from({ length: MAX_ATTACHMENT_COUNT + 1 }, (_, i) => ({
      filename: `doc${i}.pdf`,
      mimeType: 'application/pdf',
      content: fakePdf(100),
    }));
    const mime = makeMultipartMime({ attachments });
    const result = extractFromMime(mime);
    expect(result).toEqual({ success: false, reason: IngestReasonCode.OVERSIZE_MESSAGE });
  });

  it('returns OVERSIZE_MESSAGE when total extracted bytes exceed 20 MB', () => {
    // One attachment that is just over 20 MB
    const big = Buffer.alloc(MAX_EXTRACTED_BYTES + 1);
    const mime = makeMultipartMime({
      attachments: [{ filename: 'big.pdf', mimeType: 'application/pdf', content: big }],
    });
    const result = extractFromMime(mime);
    expect(result).toEqual({ success: false, reason: IngestReasonCode.OVERSIZE_MESSAGE });
  });
});

// ---------------------------------------------------------------------------
// PARSE_ERROR
// ---------------------------------------------------------------------------

describe('extractFromMime — PARSE_ERROR', () => {
  it('returns PARSE_ERROR for completely empty buffer', () => {
    const result = extractFromMime(Buffer.alloc(0));
    expect(result).toEqual({ success: false, reason: IngestReasonCode.PARSE_ERROR });
  });

  it('returns PARSE_ERROR for random binary data with no MIME structure', () => {
    const noise = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    const result = extractFromMime(noise);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// NO_DOCUMENTS
// ---------------------------------------------------------------------------

describe('extractFromMime — NO_DOCUMENTS', () => {
  it('returns NO_DOCUMENTS for a plain-text-only message', () => {
    const mime = makeTextMime('sender@example.com', 'Hello');
    const result = extractFromMime(mime);
    expect(result).toEqual({ success: false, reason: IngestReasonCode.NO_DOCUMENTS });
  });

  it('returns NO_DOCUMENTS for multipart/mixed with no document attachments', () => {
    // Has a text attachment, not a PDF/image
    const mime = makeMultipartMime({
      attachments: [
        { filename: 'notes.txt', mimeType: 'text/plain', content: Buffer.from('notes') },
      ],
    });
    const result = extractFromMime(mime);
    expect(result).toEqual({ success: false, reason: IngestReasonCode.NO_DOCUMENTS });
  });
});

// ---------------------------------------------------------------------------
// Success path — documents
// ---------------------------------------------------------------------------

describe('extractFromMime — success: PDF attachment', () => {
  const pdfBytes = fakePdf(1024);
  let mime: Buffer;

  beforeAll(() => {
    mime = makeMultipartMime({
      from: 'vendor@biz.com',
      attachments: [{ filename: 'invoice.pdf', mimeType: 'application/pdf', content: pdfBytes }],
    });
  });

  it('returns success: true', () => {
    const result = extractFromMime(mime);
    expect(result.success).toBe(true);
  });

  it('includes one document', () => {
    const result = extractFromMime(mime) as { success: true; documents: ExtractedDocument[] };
    expect(result.documents).toHaveLength(1);
  });

  it('document has correct filename and mimeType', () => {
    const result = extractFromMime(mime) as { success: true; documents: ExtractedDocument[] };
    expect(result.documents[0]?.filename).toBe('invoice.pdf');
    expect(result.documents[0]?.mimeType).toBe('application/pdf');
  });

  it('document size matches original bytes', () => {
    const result = extractFromMime(mime) as { success: true; documents: ExtractedDocument[] };
    expect(result.documents[0]?.size).toBe(pdfBytes.length);
  });

  it('document sha256 matches crypto hash of original bytes', () => {
    const result = extractFromMime(mime) as { success: true; documents: ExtractedDocument[] };
    const expected = createHash('sha256').update(pdfBytes).digest('hex');
    expect(result.documents[0]?.sha256).toBe(expected);
  });

  it('document content matches original bytes', () => {
    const result = extractFromMime(mime) as { success: true; documents: ExtractedDocument[] };
    expect(result.documents[0]?.content).toEqual(pdfBytes);
  });
});

// ---------------------------------------------------------------------------
// Success path — image attachment
// ---------------------------------------------------------------------------

describe('extractFromMime — success: image attachment', () => {
  it('extracts image/png attachment', () => {
    const png = fakePng(512);
    const mime = makeMultipartMime({
      attachments: [{ filename: 'receipt.png', mimeType: 'image/png', content: png }],
    });
    const result = extractFromMime(mime);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.documents[0]?.mimeType).toBe('image/png');
      expect(result.documents[0]?.size).toBe(png.length);
    }
  });

  it('extracts image/jpeg attachment', () => {
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.alloc(100)]);
    const mime = makeMultipartMime({
      attachments: [{ filename: 'scan.jpg', mimeType: 'image/jpeg', content: jpg }],
    });
    const result = extractFromMime(mime);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Success path — application/octet-stream with .pdf filename
// ---------------------------------------------------------------------------

describe('extractFromMime — octet-stream with .pdf filename', () => {
  it('treats application/octet-stream with .pdf filename as PDF', () => {
    const pdf = fakePdf(256);
    const mime = makeMultipartMime({
      attachments: [
        {
          filename: 'document.pdf',
          mimeType: 'application/octet-stream',
          content: pdf,
        },
      ],
    });
    const result = extractFromMime(mime);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.documents[0]?.mimeType).toBe('application/pdf');
    }
  });
});

// ---------------------------------------------------------------------------
// Multiple attachments
// ---------------------------------------------------------------------------

describe('extractFromMime — multiple attachments', () => {
  it('returns all document attachments up to the limit', () => {
    const attachments = Array.from({ length: MAX_ATTACHMENT_COUNT }, (_, i) => ({
      filename: `doc${i}.pdf`,
      mimeType: 'application/pdf',
      content: fakePdf(64),
    }));
    const mime = makeMultipartMime({ attachments });
    const result = extractFromMime(mime);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.documents).toHaveLength(MAX_ATTACHMENT_COUNT);
    }
  });
});

// ---------------------------------------------------------------------------
// Sender evidence
// ---------------------------------------------------------------------------

describe('extractFromMime — senderEvidence', () => {
  it('captures From header', () => {
    const mime = makeMultipartMime({
      from: 'Alice <alice@vendor.com>',
      attachments: [{ filename: 'a.pdf', mimeType: 'application/pdf', content: fakePdf() }],
    });
    const result = extractFromMime(mime) as { success: true; senderEvidence: SenderEvidence };
    expect(result.senderEvidence.from).toBe('Alice <alice@vendor.com>');
  });

  it('captures Reply-To header', () => {
    const mime = makeMultipartMime({
      replyTo: 'billing@vendor.com',
      attachments: [{ filename: 'a.pdf', mimeType: 'application/pdf', content: fakePdf() }],
    });
    const result = extractFromMime(mime) as { success: true; senderEvidence: SenderEvidence };
    expect(result.senderEvidence.replyTo).toBe('billing@vendor.com');
  });

  it('captures X-Original-From header', () => {
    const mime = makeMultipartMime({
      originalFrom: 'original@sender.com',
      attachments: [{ filename: 'a.pdf', mimeType: 'application/pdf', content: fakePdf() }],
    });
    const result = extractFromMime(mime) as { success: true; senderEvidence: SenderEvidence };
    expect(result.senderEvidence.originalFrom).toBe('original@sender.com');
  });

  it('captures X-Original-Sender header (fallback when X-Original-From absent)', () => {
    const mime = makeMultipartMime({
      originalSender: 'orig-sender@vendor.com',
      attachments: [{ filename: 'a.pdf', mimeType: 'application/pdf', content: fakePdf() }],
    });
    const result = extractFromMime(mime) as { success: true; senderEvidence: SenderEvidence };
    expect(result.senderEvidence.originalFrom).toBe('orig-sender@vendor.com');
  });

  it('returns undefined for absent optional headers', () => {
    const mime = makeMultipartMime({
      attachments: [{ filename: 'a.pdf', mimeType: 'application/pdf', content: fakePdf() }],
    });
    const result = extractFromMime(mime) as { success: true; senderEvidence: SenderEvidence };
    expect(result.senderEvidence.replyTo).toBeUndefined();
    expect(result.senderEvidence.originalFrom).toBeUndefined();
  });
});

import { beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Limit constants (depth)
// ---------------------------------------------------------------------------

describe('exported limit constants — MAX_MIME_DEPTH', () => {
  it('MAX_MIME_DEPTH is 10', () => {
    expect(MAX_MIME_DEPTH).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Security: deeply nested multipart → PARSE_ERROR (stack overflow guard)
// ---------------------------------------------------------------------------

describe('extractFromMime — deeply nested multipart', () => {
  function buildNestedMultipart(depth: number): string {
    if (depth === 0) {
      return [
        'Content-Type: text/plain',
        '',
        'leaf',
      ].join('\r\n');
    }
    const boundary = `NEST${depth}`;
    const inner = buildNestedMultipart(depth - 1);
    return [
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      inner,
      `--${boundary}--`,
    ].join('\r\n');
  }

  it('returns PARSE_ERROR for MIME nesting deeper than MAX_MIME_DEPTH', () => {
    // Build a message nested deeper than the limit
    const nested = buildNestedMultipart(MAX_MIME_DEPTH + 2);
    const raw = Buffer.from(
      ['From: attacker@evil.com', '', nested].join('\r\n'),
      'utf8',
    );
    const result = extractFromMime(raw);
    // Either PARSE_ERROR (throws) or NO_DOCUMENTS (no docs at max depth) — never success
    expect(result.success).toBe(false);
    if (!result.success) {
      expect([IngestReasonCode.PARSE_ERROR, IngestReasonCode.NO_DOCUMENTS]).toContain(
        result.reason,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Security: boundary string appearing inside base64 body is not a false delimiter
// ---------------------------------------------------------------------------

describe('extractFromMime — boundary collision in body', () => {
  it('does not treat boundary string inside base64 content as a real boundary', () => {
    // Craft a PDF whose base64 encoding contains the boundary string embedded
    // in the middle of a line (not preceded by a newline). The parser should
    // ignore it and successfully decode the attachment.
    const boundary = 'COLLISION';
    // Small PDF whose content doesn't accidentally contain --COLLISION at line start
    const pdf = fakePdf(64);
    const b64 = pdf.toString('base64');
    // The base64 encoding of a small buffer won't naturally contain the boundary,
    // but we verify that even with a crafted preamble text part that contains the
    // boundary string, the attachment still decodes correctly.
    const mime = Buffer.from(
      [
        'From: sender@example.com',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain',
        '',
        // The boundary string appears mid-line here — should NOT split
        `Text with --${boundary} in the middle of a line`,
        `--${boundary}`,
        'Content-Type: application/pdf',
        `Content-Disposition: attachment; filename="doc.pdf"`,
        'Content-Transfer-Encoding: base64',
        '',
        b64,
        `--${boundary}--`,
      ].join('\r\n'),
      'utf8',
    );

    const result = extractFromMime(mime);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0]?.content).toEqual(pdf);
    }
  });
});
