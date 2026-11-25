/**
 * Key of a country code in `YearLayout.countries` (SPEC §3.6): codes are zero-padded to 3 digits
 * (`'40'` → `'040'`) and the special code `-88` ("country unknown") stays as is.
 */
export function countryKey(code: string): string {
  return code === '-88' ? code : code.padStart(3, '0');
}
