import { CodecDecodeError } from '../../src/codec/types.js';
import { generate1214, parse1214 } from '../../src/index.js';
import { canonicalize } from '../../src/normalize/canonical.js';
import { minimalInput } from '../fixtures/builders.js';

const OPTIONS = { today: () => '2025-03-31' };
const CRLF = '\r\n';

/** `text` with `line` (1-based) overwritten from `position` (1-based) by `value`. */
function tamper(text: string, line: number, position: number, value: string): string {
  const lines = text.split(CRLF);
  const target = lines[line - 1];
  if (target === undefined) {
    throw new Error(`missing line ${line}`);
  }
  lines[line - 1] =
    target.slice(0, position - 1) + value + target.slice(position - 1 + value.length);
  return lines.join(CRLF);
}

describe('parse1214', () => {
  const { text, bytes } = generate1214(
    minimalInput({ meta: { softwareName: 'MY SOFT', saveDate: '2025-02-03' } }),
    OPTIONS,
  );

  it('returns the canonical report, the save date and the software name', () => {
    const result = parse1214(bytes);
    expect(result.saveDate).toBe('2025-02-03');
    expect(result.softwareName).toBe('MY SOFT');
    expect(result.report).toEqual(
      canonicalize(
        minimalInput({ meta: { softwareName: 'MY SOFT', saveDate: '2025-02-03' } }),
        OPTIONS,
      ),
    );
    expect(result.issues).toEqual([]);
  });

  it('accepts LF line endings', () => {
    expect(parse1214(text.replaceAll(CRLF, '\n')).report).toEqual(parse1214(bytes).report);
  });

  it('returns field issues of a well-formed but invalid file with input paths, without throwing', () => {
    const blankName = tamper(text, 1, 175, ' '.repeat(50));
    const result = parse1214(blankName);
    expect(result.report.company).not.toHaveProperty('registeredName');
    expect(result.issues).toEqual([
      expect.objectContaining({
        ruleId: 'field.required',
        severity: 'error',
        path: 'company.registeredName',
        recordType: '1000',
      }),
    ]);
  });

  it('locates issues of shareholder records by their input index', () => {
    const latinName = tamper(text, 2, 148, 'Israel Israeli'.padStart(50, ' '));
    expect(parse1214(latinName).issues).toEqual([
      expect.objectContaining({
        ruleId: 'field.hebrewFirstLetter',
        path: 'shareholders[0].fullName',
        recordType: '1020',
        recordIndex: 0,
      }),
    ]);
  });

  it('reads the layout from the tax year of record 1000', () => {
    const { bytes: bytes2025 } = generate1214(minimalInput({ taxYear: 2025 }), OPTIONS);
    expect(parse1214(bytes2025).report.taxYear).toBe(2025);
  });

  it('throws CodecDecodeError for undecodable content (structural errors are C7b)', () => {
    expect(() => parse1214(tamper(text, 1, 137, 'X'))).toThrow(CodecDecodeError);
    expect(() => parse1214(text.split(CRLF).slice(1).join(CRLF))).toThrow(CodecDecodeError);
    expect(() => parse1214('')).toThrow(CodecDecodeError);
  });
});
