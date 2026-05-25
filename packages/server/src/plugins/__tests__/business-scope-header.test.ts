import { describe, expect, it } from 'vitest';
import {
  BUSINESS_SCOPE_HEADER,
  parseBusinessScopeHeader,
} from '../business-scope-header.js';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

describe('BUSINESS_SCOPE_HEADER', () => {
  it('is the pinned lower-case header name', () => {
    expect(BUSINESS_SCOPE_HEADER).toBe('x-business-scope');
  });
});

describe('parseBusinessScopeHeader', () => {
  it('treats a missing header as absent', () => {
    expect(parseBusinessScopeHeader(undefined)).toEqual({ kind: 'absent' });
    expect(parseBusinessScopeHeader(null)).toEqual({ kind: 'absent' });
  });

  it('treats a blank/whitespace header as absent (no narrowing)', () => {
    expect(parseBusinessScopeHeader('')).toEqual({ kind: 'absent' });
    expect(parseBusinessScopeHeader('   ')).toEqual({ kind: 'absent' });
  });

  it('parses a single valid uuid', () => {
    expect(parseBusinessScopeHeader(A)).toEqual({ kind: 'valid', businessIds: [A] });
  });

  it('parses multiple valid uuids preserving order', () => {
    expect(parseBusinessScopeHeader(`${A},${B}`)).toEqual({
      kind: 'valid',
      businessIds: [A, B],
    });
  });

  it('normalizes surrounding whitespace around entries', () => {
    expect(parseBusinessScopeHeader(`  ${A} ,  ${B}  `)).toEqual({
      kind: 'valid',
      businessIds: [A, B],
    });
  });

  it('lower-cases and de-duplicates entries, preserving first-seen order', () => {
    expect(parseBusinessScopeHeader(`${A.toUpperCase()},${B},${A}`)).toEqual({
      kind: 'valid',
      businessIds: [A, B],
    });
  });

  it('reports a non-uuid entry as INVALID_UUID', () => {
    expect(parseBusinessScopeHeader(`${A},not-a-uuid`)).toEqual({
      kind: 'invalid',
      errors: [{ code: 'INVALID_UUID', value: 'not-a-uuid' }],
    });
  });

  it('reports an empty entry (trailing comma) as EMPTY_ENTRY', () => {
    expect(parseBusinessScopeHeader(`${A},`)).toEqual({
      kind: 'invalid',
      errors: [{ code: 'EMPTY_ENTRY' }],
    });
  });

  it('reports an empty middle entry as EMPTY_ENTRY', () => {
    expect(parseBusinessScopeHeader(`${A},,${B}`)).toEqual({
      kind: 'invalid',
      errors: [{ code: 'EMPTY_ENTRY' }],
    });
  });

  it('collects multiple errors across a mixed input', () => {
    const result = parseBusinessScopeHeader(`${A},bad,,${B}`);
    expect(result).toEqual({
      kind: 'invalid',
      errors: [
        { code: 'INVALID_UUID', value: 'bad' },
        { code: 'EMPTY_ENTRY' },
      ],
    });
  });
});
