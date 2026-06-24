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

/** Build a single text/html MIME message with the given HTML body. */
function makeHtmlMime(html: string, from = 'forwarder@gmail.com'): Buffer {
  return Buffer.from(
    [
      `From: ${from}`,
      `To: invoices@example.com`,
      `Subject: Fwd: Invoice`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      html,
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

  it('does NOT reject a message at exactly 25 MB as oversize', () => {
    // A buffer of exactly MAX size must not trigger the oversize check.
    const exact = Buffer.alloc(MAX_RAW_MIME_BYTES);
    const result = extractFromMime(exact);
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
});

// ---------------------------------------------------------------------------
// Attachment-less messages — no longer an extraction failure
// ---------------------------------------------------------------------------

describe('extractFromMime — attachment-less messages', () => {
  it('succeeds with empty documents for a plain-text-only message', () => {
    const mime = makeTextMime('sender@example.com', 'Hello', 'just some text');
    const result = extractFromMime(mime);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.documents).toHaveLength(0);
      expect(result.body).toContain('just some text');
      expect(result.senderEvidence.from).toBe('sender@example.com');
    }
  });

  it('extracts the Subject header for the downstream charge description', () => {
    const mime = makeTextMime('sender@example.com', 'Invoice #42', 'body');
    const result = extractFromMime(mime);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.subject).toBe('Invoice #42');
    }
  });

  it('succeeds with empty documents for multipart with no document attachments', () => {
    // Has a text attachment, not a PDF/image
    const mime = makeMultipartMime({
      attachments: [
        { filename: 'notes.txt', mimeType: 'text/plain', content: Buffer.from('notes') },
      ],
    });
    const result = extractFromMime(mime);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.documents).toHaveLength(0);
    }
  });

  it('tolerates structureless/binary input as an empty message (no documents)', () => {
    // Post-WS-B the emptiness decision is deferred downstream: input with no
    // recognizable MIME structure parses as an empty message (no documents,
    // empty body) and is quarantined later, rather than failing at parse time.
    // (A genuinely empty buffer is still a PARSE_ERROR — see above.)
    const result = extractFromMime(Buffer.from([0x00, 0x01, 0x02, 0x03]));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.documents).toHaveLength(0);
      expect(result.body).toBe('');
    }
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
    // Build a message nested deeper than the limit. The multipart Content-Type
    // must lead the top-level header block (no blank line before it), otherwise
    // it lands in the body and the top level parses as text/plain — never
    // recursing into the nested structure that the depth guard protects against.
    const nested = buildNestedMultipart(MAX_MIME_DEPTH + 2);
    const raw = Buffer.from(['From: attacker@evil.com', nested].join('\r\n'), 'utf8');
    const result = extractFromMime(raw);
    // Exceeding the nesting limit throws → PARSE_ERROR (never success).
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe(IngestReasonCode.PARSE_ERROR);
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

  it('does not mistake a nested boundary that the outer boundary is a prefix of', () => {
    // Outer boundary `BND` is a prefix of the inner boundary `BND-1`. A naive
    // `indexOf("--BND")` matches inside `--BND-1`, so the outer parser would
    // split parts at the inner boundary and drop the attachment. The delimiter
    // must be followed by whitespace/CRLF or `--` to count as a real boundary.
    const outer = 'BND';
    const inner = 'BND-1';
    const pdf = fakePdf(64);
    const b64 = pdf.toString('base64');

    const innerPart = [
      `Content-Type: multipart/related; boundary="${inner}"`,
      '',
      `--${inner}`,
      'Content-Type: application/pdf',
      `Content-Disposition: attachment; filename="doc.pdf"`,
      'Content-Transfer-Encoding: base64',
      '',
      b64,
      `--${inner}--`,
    ].join('\r\n');

    const mime = Buffer.from(
      [
        'From: sender@example.com',
        'To: invoices@example.com',
        'Subject: Prefix collision',
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${outer}"`,
        '',
        `--${outer}`,
        'Content-Type: text/plain',
        '',
        'See attached.',
        `--${outer}`,
        innerPart,
        `--${outer}--`,
      ].join('\r\n'),
      'utf8',
    );

    const result = extractFromMime(mime);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0]?.content).toEqual(pdf);
      expect(result.documents[0]?.filename).toBe('doc.pdf');
    }
  });
});

// ---------------------------------------------------------------------------
// Body capture & issuer candidates
// ---------------------------------------------------------------------------

describe('extractFromMime — body capture & issuer candidates', () => {
  it('captures the HTML body of a text/html message', () => {
    const result = extractFromMime(makeHtmlMime('<p>hello body world</p>'));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.body).toContain('hello body world');
    }
  });

  it('prefers the HTML body over text/plain in multipart/alternative', () => {
    const boundary = 'ALT001';
    const mime = Buffer.from(
      [
        'From: sender@example.com',
        'To: invoices@example.com',
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        'plain version',
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        '<p>html version</p>',
        `--${boundary}--`,
      ].join('\r\n'),
      'utf8',
    );
    const result = extractFromMime(mime);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.body).toContain('html version');
      expect(result.body).not.toContain('plain version');
    }
  });

  it('extracts (and URL-decodes) issuer mailto candidates from "From:" links in the body', () => {
    const html =
      '<div>From: Real Vendor &lt;<a href="mailto:real%40vendor.com">real@vendor.com</a>&gt;</div>';
    const result = extractFromMime(makeHtmlMime(html));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.senderEvidence.issuerCandidates).toContain('real@vendor.com');
    }
  });

  it('returns no issuer candidates when the body has no From: mailto link', () => {
    const result = extractFromMime(makeHtmlMime('<p>no contact links here</p>'));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.senderEvidence.issuerCandidates).toEqual([]);
    }
  });

  it('matches issuer candidates across a newline-wrapped From: line', () => {
    const html = 'From: Real Vendor\r\n<a href="mailto:wrapped@vendor.com">link</a>';
    const result = extractFromMime(makeHtmlMime(html));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.senderEvidence.issuerCandidates).toContain('wrapped@vendor.com');
    }
  });

  it('decodes a non-UTF-8 (windows-1255) text body via its declared charset', () => {
    const header = Buffer.from(
      [
        'From: sender@example.com',
        'To: invoices@example.com',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=windows-1255',
        'Content-Transfer-Encoding: 8bit',
        '',
        '',
      ].join('\r\n'),
      'ascii',
    );
    // 0xE0 0xE1 0xE2 = אבג in windows-1255
    const mime = Buffer.concat([header, Buffer.from([0xe0, 0xe1, 0xe2])]);
    const result = extractFromMime(mime);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.body).toBe('אבג');
    }
  });
});
