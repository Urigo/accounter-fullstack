/**
 * Property suite (SPEC §13.6): 200 seeded random reports. Each seed is its own test, named after
 * the seed, so a failure is reproduced with `randomValidInput(<seed>)`. Every report validates with
 * no errors and no warnings, and parse(generate(x)) is canonicalize(x). A coverage check keeps the
 * generator from silently narrowing: across the seeds, every record type and every capital-gains
 * type is generated.
 */
import { generate1214, parse1214, validate1214, type GenerateOptions } from '../../src/index.js';
import type { RecordType } from '../../src/layout/types.js';
import { CAPITAL_GAINS_SYMBOLS } from '../../src/model/codes.generated.js';
import { canonicalize } from '../../src/normalize/canonical.js';
import { isValidIsraeliCheckDigit } from '../../src/validate/check-digit.js';
import {
  israeliCheckDigit,
  mulberry32,
  randomDate,
  randomId9,
  randomText,
  randomValidInput,
} from '../fixtures/random.js';

const OPTIONS: GenerateOptions = { today: () => '2025-06-30' };
const SEEDS = Array.from({ length: 200 }, (_, index) => index + 1);
const TIMEOUT_MS = 60_000;
const CRLF = '\r\n';

const ALL_RECORD_TYPES: readonly RecordType[] = [
  '1000',
  '1010',
  '1020',
  '1030',
  '2000',
  '2200',
  '3027',
  '3050',
  '3051',
  '3054',
  '3060',
  '3063',
  '3064',
  '3065',
  '3066',
  '3077',
  '9999',
];

/** The record types (positions 5–8) of the lines of a generated file. */
function recordTypesOf(text: string): Set<string> {
  return new Set(
    text
      .split(CRLF)
      .filter(line => line.length > 0)
      .map(line => line.slice(4, 8)),
  );
}

describe('random generator helpers', () => {
  it('is deterministic per seed', () => {
    expect(randomValidInput(42)).toEqual(randomValidInput(42));
    expect(randomValidInput(42)).not.toEqual(randomValidInput(43));
  });

  it('completes 8 digits with the Israeli check digit', () => {
    expect(israeliCheckDigit('12345678')).toBe(2); // 123456782
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      expect(isValidIsraeliCheckDigit(randomId9(rng))).toBe(true);
    }
  });

  it('writes real dates and windows-1255 text within the width', () => {
    const rng = mulberry32(11);
    for (let i = 0; i < 1000; i++) {
      const date = randomDate(rng);
      expect(new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(date);
      const text = randomText(rng, 30, true);
      expect(text.length).toBeGreaterThan(0);
      expect(text.length).toBeLessThanOrEqual(30);
      expect(text).toMatch(/^[א-ת]/);
      expect(text).not.toMatch(/^ | $| {2}/);
    }
  });
});

describe('property: random valid reports', () => {
  it.each(SEEDS)(
    'seed %i: validates cleanly and parse(generate(x)) is canonicalize(x)',
    seed => {
      const input = randomValidInput(seed);
      const result = validate1214(input, OPTIONS);
      expect(result.errors, `seed ${seed}: randomValidInput(${seed}) has errors`).toEqual([]);
      // Every 2025 report carries the provisional-layout warning (SPEC §14), and nothing else.
      const provisional = input.taxYear === 2025 ? ['struct.taxYear.provisionalLayout'] : [];
      expect(
        result.warnings.map(issue => issue.ruleId),
        `seed ${seed}: randomValidInput(${seed}) has warnings`,
      ).toEqual(provisional);

      const { bytes } = generate1214(input, OPTIONS);
      const parsed = parse1214(bytes);
      expect(
        parsed.issues.map(issue => issue.ruleId),
        `seed ${seed}: the parsed file has issues`,
      ).toEqual(provisional);
      expect(parsed.report, `seed ${seed}: round trip`).toEqual(canonicalize(input, OPTIONS));
    },
    TIMEOUT_MS,
  );

  it(
    'covers every record type and every capital-gains type across the seeds',
    () => {
      const recordTypes = new Set<string>();
      const symbols = new Set<number>();
      let kibbutzWithoutShareholders = 0;
      for (const seed of SEEDS) {
        const input = randomValidInput(seed);
        for (const type of recordTypesOf(generate1214(input, OPTIONS).text)) {
          recordTypes.add(type);
        }
        for (const appendix of input.capitalGains ?? []) {
          symbols.add(appendix.symbol);
        }
        if (input.shareholders.length === 0) {
          kibbutzWithoutShareholders++;
        }
      }
      expect([...recordTypes].sort()).toEqual([...ALL_RECORD_TYPES].sort());
      expect([...symbols].sort((a, b) => a - b)).toEqual([...CAPITAL_GAINS_SYMBOLS]);
      expect(kibbutzWithoutShareholders).toBeGreaterThan(0);
    },
    TIMEOUT_MS,
  );
});
