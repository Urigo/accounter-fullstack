import { fromWindows1255, toWindows1255 } from '../src/utils/encoding';

describe('Encoding Tests', () => {
  it('should encode and decode Hebrew text correctly', () => {
    const hebrewText = 'שלום';
    const encoded = toWindows1255(hebrewText);
    const decoded = fromWindows1255(encoded);
    expect(decoded).toBe(hebrewText);
  });

  it('should encode and decode English text correctly', () => {
    const englishText = 'Hello, World!';
    const encoded = toWindows1255(englishText);
    const decoded = fromWindows1255(encoded);
    expect(decoded).toBe(englishText);
  });

  it('should handle special characters and edge cases', () => {
    const specialChars = '!@#$%^&*()_+-=[]{}|;:",.<>?/`~';
    const encoded = toWindows1255(specialChars);
    const decoded = fromWindows1255(encoded);
    expect(decoded).toBe(specialChars);

    const emptyString = '';
    const encodedEmpty = toWindows1255(emptyString);
    const decodedEmpty = fromWindows1255(encodedEmpty);
    expect(decodedEmpty).toBe(emptyString);
  });
});
