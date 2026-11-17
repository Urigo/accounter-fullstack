import * as api from '../../src/index.js';

describe('public API', () => {
  it('exports exactly the public runtime values', () => {
    expect(Object.keys(api).sort()).toEqual(
      [
        'Opcn1214Error',
        'Opcn1214InternalError',
        'Opcn1214UnsupportedYearError',
        'getLayout',
        'supportedTaxYears',
      ].sort(),
    );
  });
});
