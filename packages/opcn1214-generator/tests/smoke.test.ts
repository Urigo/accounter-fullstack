import { SPEC_STATUS } from '../src/index.js';

describe('package harness', () => {
  it('resolves src/ through .js-suffixed imports', () => {
    expect(SPEC_STATUS).toBe('specification');
  });
});
