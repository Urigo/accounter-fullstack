/** Response codes of SHAAM's response file shumot.shg and their English meanings (SPEC §3.9). */
const RESPONSE_MEANINGS: Readonly<Record<string, string>> = {
  '00': 'Valid; saved in a temporary state',
  '01': 'File type closed, or after the last year allowed for filing',
  '04': 'Year blocked',
  '05': 'Report already filed',
  '06': 'You are not the representative of this file',
  '07': 'No file exists for the requested tax year',
  '08': 'Non-numeric value + field detail',
  '09': 'Report was transmitted',
  '15': 'Cannot transmit for the requested tax year',
  '16': 'Files mismatch',
  '20': 'Calculation type mismatch',
  '21': 'Report was transmitted via the internet',
  '23': 'A file exists for the spouse too; contact the account card',
  '31': 'Invalid record type',
  '32': 'Invalid form type',
  '33': 'Invalid value + field detail',
  '97': 'Report is being handled by the tax office',
  '98': 'Representatives-registry connection problem; notify SHAAM',
  '99': 'Input data problem; notify SHAAM',
};

/** Meaning of a code SPEC §3.9 does not list. */
const GENERAL_ERROR = 'General error; notify SHAAM';

/** The English meaning of a response code (SPEC §3.9); any unlisted code is a general error. */
export function responseMeaning(code: string): string {
  return Object.hasOwn(RESPONSE_MEANINGS, code) ? RESPONSE_MEANINGS[code] : GENERAL_ERROR;
}
