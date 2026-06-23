import { afterAll, describe, expect, it, vi } from 'vitest';
import type { ExtractedDocument } from '../mime-extractor.js';
import type { BusinessEmailConfig } from '../server-client.js';
import { applyTreatment, type TreatmentDeps } from '../treatment.js';

/**
 * Behavioral parity tests for the v2 gateway treatment.
 *
 * Workstream C duplicated-and-adapted the legacy `gmail-listener` treatment into
 * the gateway (architecture-plan.md: "Contract and behavior parity is enforced
 * by tests, not by shared runtime modules"). These tests pin that parity: for
 * each representative provider category, `applyTreatment` must produce the same
 * document set the legacy `handleMessage` produced.
 *
 * Reference: packages/gmail-listener/src/gmail-service.ts `handleMessage`
 * (~L464-509): (1) filter attachments by `config.attachments`; (2) render the
 * body to a PDF when no business is recognized **or** `emailBody === true`;
 * (3) fetch a document for each `internalEmailLinks` entry; the document set is
 * then assembled in that order and emptiness decided afterwards.
 *
 * Unlike the per-step unit tests in `treatment.test.ts`, each case here is a
 * full provider email run end-to-end through the pipeline, asserting the
 * complete ordered document set — the same signal shadow mode compares.
 *
 * Out of scope here (covered elsewhere):
 *  - Provider skip-list / issuer selection is server-side — see
 *    server `email-ingestion-issuer.helper.test.ts`.
 *  - One charge per email on persistence — see server
 *    `email-ingestion-ingest.provider.test.ts`.
 *
 * Known intentional divergence: v2 skips the body→PDF for an empty body (legacy
 * always rendered). See the `body→PDF` empty-body case in `treatment.test.ts`.
 */

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

afterAll(() => {
  // Restore the file-level console spies so they cannot leak into other suites.
  vi.restoreAllMocks();
});

function doc(mimeType: string, name: string): ExtractedDocument {
  const content = Buffer.from(name);
  return { filename: name, mimeType, content, size: content.length, sha256: name };
}

function cfg(over: Partial<BusinessEmailConfig> = {}): BusinessEmailConfig {
  return {
    businessId: 'biz-1',
    internalEmailLinks: null,
    emailBody: false,
    attachments: null,
    ...over,
  };
}

function makeDeps(over: Partial<TreatmentDeps> = {}): TreatmentDeps {
  return {
    renderHtmlToPdf: vi.fn().mockResolvedValue(doc('application/pdf', 'body.pdf')),
    fetchInternalLinkDocuments: vi.fn().mockResolvedValue([]),
    ...over,
  };
}

describe('treatment parity with legacy handleMessage', () => {
  it('attachment-only provider → only allow-listed attachments (no body PDF, no links)', async () => {
    // Recognized business, attachments allowlist [PDF], emailBody off, no links.
    const renderHtmlToPdf = vi.fn();
    const fetchInternalLinkDocuments = vi.fn();
    const out = await applyTreatment(
      {
        config: cfg({ attachments: ['PDF'], emailBody: false, internalEmailLinks: null }),
        body: '<p>see attached invoice</p>',
        attachments: [doc('application/pdf', 'invoice.pdf'), doc('image/png', 'logo.png')],
      },
      makeDeps({ renderHtmlToPdf, fetchInternalLinkDocuments }),
    );
    // legacy L467-487: logo.png filtered out; L490 body PDF skipped (businessId set,
    // emailBody !== true); L496 no links.
    expect(out.map(d => d.filename)).toEqual(['invoice.pdf']);
    expect(renderHtmlToPdf).not.toHaveBeenCalled();
    expect(fetchInternalLinkDocuments).not.toHaveBeenCalled();
  });

  it('body-as-PDF provider → attachments plus the rendered body PDF', async () => {
    // Recognized business that opts into emailBody.
    const renderHtmlToPdf = vi.fn().mockResolvedValue(doc('application/pdf', 'body.pdf'));
    const out = await applyTreatment(
      {
        config: cfg({ attachments: null, emailBody: true, internalEmailLinks: null }),
        body: '<p>the invoice is the email body</p>',
        attachments: [doc('application/pdf', 'invoice.pdf')],
      },
      makeDeps({ renderHtmlToPdf }),
    );
    // legacy: keep all attachments (no allowlist) then L490-493 append body PDF.
    expect(out.map(d => d.filename)).toEqual(['invoice.pdf', 'body.pdf']);
    expect(renderHtmlToPdf).toHaveBeenCalledOnce();
  });

  it('internal-link provider → fetches the document behind the configured link', async () => {
    // Some providers email only a "download your invoice" link, not an attachment.
    const renderHtmlToPdf = vi.fn();
    const fetchInternalLinkDocuments = vi
      .fn()
      .mockResolvedValue([doc('application/pdf', 'external.pdf')]);
    const out = await applyTreatment(
      {
        config: cfg({
          attachments: null,
          emailBody: false,
          internalEmailLinks: ['https://vendor.com/invoice'],
        }),
        body: '<a href="https://vendor.com/invoice/123">download</a>',
        attachments: [],
      },
      makeDeps({ renderHtmlToPdf, fetchInternalLinkDocuments }),
    );
    // legacy L496-503: fetch the link doc; L490 body PDF skipped (recognized, emailBody off).
    expect(out.map(d => d.filename)).toEqual(['external.pdf']);
    expect(fetchInternalLinkDocuments).toHaveBeenCalledOnce();
    expect(renderHtmlToPdf).not.toHaveBeenCalled();
  });

  it('unrecognized sender → keeps all attachments and renders the body PDF (legacy default)', async () => {
    // No business matched → config null → legacy L490 `!businessId` branch renders body.
    const renderHtmlToPdf = vi.fn().mockResolvedValue(doc('application/pdf', 'body.pdf'));
    const out = await applyTreatment(
      {
        config: null,
        body: '<p>unknown sender invoice</p>',
        attachments: [doc('application/pdf', 'invoice.pdf')],
      },
      makeDeps({ renderHtmlToPdf }),
    );
    expect(out.map(d => d.filename)).toEqual(['invoice.pdf', 'body.pdf']);
    expect(renderHtmlToPdf).toHaveBeenCalledOnce();
  });

  it('combined provider → filtered attachments, then body PDF, then link doc (legacy order)', async () => {
    const renderHtmlToPdf = vi.fn().mockResolvedValue(doc('application/pdf', 'body.pdf'));
    const fetchInternalLinkDocuments = vi
      .fn()
      .mockResolvedValue([doc('application/pdf', 'external.pdf')]);
    const out = await applyTreatment(
      {
        config: cfg({
          attachments: ['PDF'],
          emailBody: true,
          internalEmailLinks: ['https://vendor.com/invoice'],
        }),
        body: '<a href="https://vendor.com/invoice/1">x</a>',
        attachments: [doc('application/pdf', 'invoice.pdf'), doc('image/png', 'logo.png')],
      },
      makeDeps({ renderHtmlToPdf, fetchInternalLinkDocuments }),
    );
    // legacy assembly order: attachments (filtered) → body PDF → link docs.
    expect(out.map(d => d.filename)).toEqual(['invoice.pdf', 'body.pdf', 'external.pdf']);
  });

  it('no relevant documents → empty set (downstream NO_DOCUMENTS, legacy L505)', async () => {
    // Recognized business, the only attachment is filtered out, emailBody off, no links.
    const out = await applyTreatment(
      {
        config: cfg({ attachments: ['PDF'], emailBody: false, internalEmailLinks: null }),
        body: '<p>nothing useful</p>',
        attachments: [doc('image/png', 'logo.png')],
      },
      makeDeps({ renderHtmlToPdf: vi.fn() }),
    );
    // legacy L505-509 logs "no relevant documents"; v2 returns [] and the server
    // ingest applies the NO_DOCUMENTS quarantine backstop.
    expect(out).toHaveLength(0);
  });
});
