import { codecFor, CODECS } from '../../src/codec/registry.js';
import { CODE_KINDS, FIELD_KINDS } from '../../src/layout/types.js';

describe('codec registry', () => {
  it.each([...FIELD_KINDS, ...CODE_KINDS])('%s resolves through codecFor', kind => {
    const codec = codecFor(kind);
    expect(codec).toBe(CODECS[kind]);
    expect(typeof codec.encode).toBe('function');
    expect(typeof codec.decode).toBe('function');
  });

  it('has a codec for exactly the field and code kinds', () => {
    expect(Object.keys(CODECS).toSorted()).toEqual(
      [...new Set([...FIELD_KINDS, ...CODE_KINDS])].toSorted(),
    );
  });
});
