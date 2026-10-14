import { describe, expect, it } from 'vitest';
import { DocumentType } from '../../../../gql/graphql.js';
import {
  hasViewerAttachment,
  isSafeHttpUrl,
  toDocumentViewerEntry,
  toUrlString,
} from '../source.js';

describe('isSafeHttpUrl', () => {
  it.each(['https://res.cloudinary.com/demo/image/upload/scan.jpg', 'http://example.com/a.pdf'])(
    'accepts %s',
    url => {
      expect(isSafeHttpUrl(url)).toBe(true);
    },
  );

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://example.com/a.pdf',
    'not a url',
    '/relative/scan.jpg',
    '',
    null,
  ])('rejects %s', url => {
    expect(isSafeHttpUrl(url)).toBe(false);
  });
});

describe('toUrlString', () => {
  it('normalizes strings and URLs', () => {
    expect(toUrlString(' https://a.test/x ')).toBe('https://a.test/x');
    expect(toUrlString(new URL('https://a.test/x'))).toBe('https://a.test/x');
    expect(toUrlString('   ')).toBeNull();
    expect(toUrlString(null)).toBeNull();
    expect(toUrlString(undefined)).toBeNull();
  });
});

describe('toDocumentViewerEntry', () => {
  it('maps a document row', () => {
    expect(
      toDocumentViewerEntry({
        id: 'doc-1',
        image: 'https://a.test/scan.jpg',
        file: null,
        documentType: DocumentType.Receipt,
        serialNumber: '55',
      }),
    ).toEqual({
      id: 'doc-1',
      imageUrl: 'https://a.test/scan.jpg',
      fileUrl: null,
      title: 'Receipt 55',
    });
  });

  it('knows whether there is anything to show', () => {
    const base = { title: 'Document' };
    expect(hasViewerAttachment({ ...base, imageUrl: null, fileUrl: null })).toBe(false);
    expect(hasViewerAttachment({ ...base, imageUrl: null, fileUrl: 'https://a.test/f' })).toBe(
      true,
    );
  });
});
