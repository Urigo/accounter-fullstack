import { describe, expect, it, vi } from 'vitest';
import type { ExtractedDocument } from '../mime-extractor.js';
import type { BusinessEmailConfig } from '../server-client.js';
import { applyTreatment, type TreatmentDeps } from '../treatment.js';

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

function doc(mimeType: string, name = 'f'): ExtractedDocument {
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

describe('applyTreatment — attachment filter', () => {
  it('keeps all attachments when config has no attachments allowlist', async () => {
    const out = await applyTreatment(
      { config: cfg({ attachments: null }), body: '', attachments: [doc('application/pdf'), doc('image/png')] },
      makeDeps(),
    );
    expect(out).toHaveLength(2);
  });

  it('keeps all attachments when no business is recognized (config null)', async () => {
    const out = await applyTreatment(
      { config: null, body: '', attachments: [doc('application/pdf'), doc('image/png')] },
      makeDeps({ renderHtmlToPdf: vi.fn() }),
    );
    expect(out).toHaveLength(2);
  });

  it('filters attachments to the configured allowlist', async () => {
    const out = await applyTreatment(
      { config: cfg({ attachments: ['PDF'] }), body: '', attachments: [doc('application/pdf'), doc('image/png')] },
      makeDeps(),
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.mimeType).toBe('application/pdf');
  });

  it('maps image/jpeg and image/jpg to JPEG', async () => {
    const out = await applyTreatment(
      {
        config: cfg({ attachments: ['JPEG'] }),
        body: '',
        attachments: [doc('image/jpeg'), doc('image/jpg'), doc('image/png')],
      },
      makeDeps(),
    );
    expect(out).toHaveLength(2);
  });
});

describe('applyTreatment — body→PDF', () => {
  it('renders the body when no business is recognized', async () => {
    const renderHtmlToPdf = vi.fn().mockResolvedValue(doc('application/pdf', 'body.pdf'));
    const out = await applyTreatment(
      { config: null, body: '<p>hi</p>', attachments: [] },
      makeDeps({ renderHtmlToPdf }),
    );
    expect(renderHtmlToPdf).toHaveBeenCalledOnce();
    expect(out).toHaveLength(1);
  });

  it('renders the body when emailBody === true', async () => {
    const renderHtmlToPdf = vi.fn().mockResolvedValue(doc('application/pdf', 'body.pdf'));
    await applyTreatment(
      { config: cfg({ emailBody: true }), body: '<p>hi</p>', attachments: [] },
      makeDeps({ renderHtmlToPdf }),
    );
    expect(renderHtmlToPdf).toHaveBeenCalledOnce();
  });

  it('does NOT render the body for a recognized business with emailBody !== true', async () => {
    const renderHtmlToPdf = vi.fn();
    await applyTreatment(
      { config: cfg({ emailBody: false }), body: '<p>hi</p>', attachments: [] },
      makeDeps({ renderHtmlToPdf }),
    );
    expect(renderHtmlToPdf).not.toHaveBeenCalled();
  });

  it('skips body render for an empty body', async () => {
    const renderHtmlToPdf = vi.fn();
    await applyTreatment(
      { config: null, body: '   ', attachments: [] },
      makeDeps({ renderHtmlToPdf }),
    );
    expect(renderHtmlToPdf).not.toHaveBeenCalled();
  });

  it('swallows a render failure and keeps the other documents', async () => {
    const renderHtmlToPdf = vi.fn().mockRejectedValue(new Error('no chromium'));
    const out = await applyTreatment(
      { config: null, body: '<p>hi</p>', attachments: [doc('application/pdf')] },
      makeDeps({ renderHtmlToPdf }),
    );
    expect(out).toHaveLength(1);
  });
});

describe('applyTreatment — internal links', () => {
  it('fetches documents for each configured internalEmailLink, in order', async () => {
    const fetchInternalLinkDocuments = vi
      .fn()
      .mockResolvedValueOnce([doc('application/pdf', 'a.pdf')])
      .mockResolvedValueOnce([doc('application/pdf', 'b.pdf')]);
    const out = await applyTreatment(
      {
        config: cfg({ internalEmailLinks: ['https://x.com/a', 'https://y.com/b'] }),
        body: 'body',
        attachments: [],
      },
      makeDeps({ fetchInternalLinkDocuments }),
    );
    expect(fetchInternalLinkDocuments).toHaveBeenCalledTimes(2);
    expect(out.map(d => d.filename)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('swallows a link-fetch failure and continues', async () => {
    const fetchInternalLinkDocuments = vi.fn().mockRejectedValue(new Error('network'));
    const out = await applyTreatment(
      {
        config: cfg({ internalEmailLinks: ['https://x.com/a'], attachments: null }),
        body: 'body',
        attachments: [doc('application/pdf')],
      },
      makeDeps({ fetchInternalLinkDocuments }),
    );
    expect(out).toHaveLength(1);
  });
});
