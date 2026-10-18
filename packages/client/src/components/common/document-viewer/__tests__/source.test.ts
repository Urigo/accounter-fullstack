import { describe, expect, it } from 'vitest';
import { DocumentType } from '../../../../gql/graphql.js';
import {
  hasViewerAttachment,
  isSafeHttpUrl,
  previewImageUrl,
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

describe('previewImageUrl', () => {
  const STORED = 'https://example.com/stored.jpg';

  it('uses a typed http(s) URL, trimmed', () => {
    expect(previewImageUrl(' https://example.com/new.jpg ', STORED)).toBe(
      'https://example.com/new.jpg',
    );
    expect(previewImageUrl('http://example.com/new.jpg', STORED)).toBe('http://example.com/new.jpg');
    expect(previewImageUrl(new URL('https://example.com/u.jpg'), STORED)).toBe(
      'https://example.com/u.jpg',
    );
  });

  it.each([
    ['localhost', 'http://localhost:3000/scan.jpg'],
    ['an IPv4 address', 'http://10.0.0.1/scan.jpg'],
    ['a subdomain', 'https://res.cloudinary.com/demo/scan.jpg'],
  ])('uses a URL whose host is %s', (_, value) => {
    expect(previewImageUrl(value, STORED)).toBe(value);
  });

  it.each([
    ['a host still being typed', 'https://exam'],
    ['a host ending in a dot', 'https://exam.'],
    ['a single-label host with a path', 'https://intranet/scan.jpg'],
  ])('does not fetch %s while typing', (_, value) => {
    expect(previewImageUrl(value, STORED)).toBe(STORED);
  });

  it.each([
    ['empty', ''],
    ['half-typed', 'https://'],
    ['relative', 'scan.jpg'],
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:image/png;base64,AAAA'],
    ['undefined', undefined],
    ['a number', 42],
  ])('falls back to the stored image for %s', (_, value) => {
    expect(previewImageUrl(value, STORED)).toBe(STORED);
    expect(previewImageUrl(value, null)).toBeNull();
  });

  it('works where URL.canParse is missing', () => {
    const canParse = URL.canParse;
    Object.defineProperty(URL, 'canParse', { configurable: true, value: undefined });
    try {
      expect(previewImageUrl('https://example.com/new.jpg', STORED)).toBe(
        'https://example.com/new.jpg',
      );
      expect(previewImageUrl('nope', STORED)).toBe(STORED);
    } finally {
      Object.defineProperty(URL, 'canParse', { configurable: true, value: canParse });
    }
  });
});
