/**
 * Seeded random inputs for the property suite (SPEC §13.6). `randomValidInput(seed)` composes the
 * builders' vocabulary into a report that satisfies EVERY rule of SPEC §10 (no errors and no
 * warnings): when a seed fails validation, the generator is fixed, never a rule.
 *
 * Every value respects its field: identifiers pass the Israeli check digit, text is
 * windows-1255-representable (Hebrew, Latin, digits and plain punctuation; no emoji, no bidi or
 * invisible characters) and fits its width, `hebrewText` starts with a Hebrew letter, dates are
 * real calendar dates, ×100 amounts and percentages have at most 2 decimals, and the cross-field
 * rules (dividend rights total, conditional codes, breakdowns, wallets, …) hold.
 */
import { getLayout } from '../../src/layout/registry.js';
import type { CodeDef, RecordDef } from '../../src/layout/types.js';
import {
  CAPITAL_GAINS_SYMBOLS,
  COUNTRY_CODES,
  type CapitalGainsSymbol,
  type CountryBreakdownCode,
  type CountryCode,
} from '../../src/model/codes.generated.js';
import {
  PHONE_PREFIXES,
  type AssetLocation,
  type CapitalGainsAppendix,
  type CountryBreakdown,
  type Declarations,
  type ForeignAppendix,
  type Phone,
  type PreparerDetails,
  type RdInvestment,
  type RelatedCompany,
  type Report1214Input,
  type Shareholder,
  type SupportedTaxYear,
  type Withholder,
  type WithholdingStatus,
} from '../../src/model/input.js';
import { expectedWithholdingFileNumber } from '../../src/validate/main-rules.js';
import type { Improvement } from './builders.js';

/** A source of uniform numbers in [0, 1). */
export type Rng = () => number;

/** mulberry32: a small, fast, seeded 32-bit PRNG. */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** An integer in [min, max]. */
export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function chance(rng: Rng, probability: number): boolean {
  return rng() < probability;
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[randomInt(rng, 0, items.length - 1)];
  if (item === undefined) {
    throw new Error('pick from an empty list');
  }
  return item;
}

/** `items` in a random order (Fisher–Yates on a copy). */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(rng, 0, i);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** `count` distinct items of `items`, in a random order. */
function sample<T>(rng: Rng, items: readonly T[], count: number): T[] {
  return shuffle(rng, items).slice(0, count);
}

/** `value` with probability `probability`, otherwise undefined. */
function maybe<T>(rng: Rng, make: () => T, probability = 0.5): T | undefined {
  return chance(rng, probability) ? make() : undefined;
}

/** `object` without its undefined members (absent rather than explicitly undefined). */
function compact<T extends object>(object: T): T {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined)) as T;
}

// ---------------------------------------------------------------------------------------------
// Identifiers

/** The Israeli check digit (SPEC §4.2) that completes the 8 digits of `prefix`. */
export function israeliCheckDigit(prefix: string): number {
  let total = 0;
  for (const [index, char] of [...prefix.padStart(8, '0')].entries()) {
    const product = Number(char) * (index % 2 === 0 ? 1 : 2);
    total += product > 9 ? product - 9 : product;
  }
  return (10 - (total % 10)) % 10;
}

/**
 * A check-digit-valid identifier: 8 random digits completed by their check digit. Sometimes the
 * prefix is small and the leading zeros are dropped ('000001236' → '1236'), which canonicalization
 * pads back (SPEC §8.4).
 */
export function randomId9(rng: Rng): string {
  const small = chance(rng, 0.1);
  const prefix = String(randomInt(rng, small ? 1 : 10_000_000, small ? 9999 : 99_999_999)).padStart(
    8,
    '0',
  );
  const id = `${prefix}${israeliCheckDigit(prefix)}`;
  return small && chance(rng, 0.5) ? id.replace(/^0+/, '') : id;
}

function randomDigits(rng: Rng, length: number): string {
  return Array.from({ length }, () => String(randomInt(rng, 0, 9))).join('');
}

// ---------------------------------------------------------------------------------------------
// Text

const HEBREW_LETTERS = 'אבגדהוזחטיכךלמםנןסעפףצץקרשת';
const LATIN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const PUNCTUATION = `-.,"'/()&׳״`;
const ADDRESS_WORDS = ['רחוב', 'שדרות', 'דרך', 'תל אביב', 'חיפה', 'ירושלים', 'באר שבע', 'בע"מ'];

/**
 * Random windows-1255 text of 1..`width` characters (exactly `width` sometimes): words of Hebrew,
 * Latin, digits and punctuation separated by single spaces, never starting or ending with a
 * space. `hebrewFirst` makes the first character a Hebrew letter (kind `hebrewText`).
 */
export function randomText(rng: Rng, width: number, hebrewFirst = false): string {
  const length = chance(rng, 0.15) ? width : randomInt(rng, 1, width);
  const chars: string[] = [];
  while (chars.length < length) {
    const position = chars.length;
    const last = chars[position - 1];
    if (position === 0) {
      chars.push(
        hebrewFirst || chance(rng, 0.6) ? pick(rng, [...HEBREW_LETTERS]) : pick(rng, [...LATIN]),
      );
    } else if (position < length - 1 && last !== ' ' && chance(rng, 0.15)) {
      chars.push(' ');
    } else if (chance(rng, 0.08) && position >= 1) {
      chars.push(pick(rng, [...PUNCTUATION]));
    } else if (chance(rng, 0.1)) {
      chars.push(pick(rng, [...DIGITS]));
    } else if (chance(rng, 0.2)) {
      chars.push(pick(rng, [...LATIN]));
    } else {
      chars.push(pick(rng, [...HEBREW_LETTERS]));
    }
  }
  return chars.join('');
}

function randomAddress(rng: Rng): string {
  return chance(rng, 0.5)
    ? `${pick(rng, ADDRESS_WORDS)} ${randomText(rng, 20, true)} ${randomInt(rng, 1, 999)}`
    : randomText(rng, 50);
}

function randomLatin(rng: Rng, min: number, max: number): string {
  return Array.from({ length: randomInt(rng, min, max) }, () =>
    pick(rng, [...LATIN, ...DIGITS]),
  ).join('');
}

// ---------------------------------------------------------------------------------------------
// Numbers and dates

/** A whole amount below 10^width, with a random number of digits (so small values are common). */
function randomWhole(rng: Rng, width: number): number {
  const digits = randomInt(rng, 1, width);
  return randomInt(rng, 0, 10 ** digits - 1);
}

/** A positive whole amount below 10^width. */
function randomPositiveWhole(rng: Rng, width: number): number {
  return Math.max(1, randomWhole(rng, width));
}

/** An amount with 0–2 decimals whose ×100 value has at most `width` digits. */
function randomAmountX100(rng: Rng, width: number): number {
  const cents = randomWhole(rng, width);
  return chance(rng, 0.5) ? Math.floor(cents / 100) : cents / 100;
}

/** A positive amount with 0–2 decimals whose ×100 value has at most `width` digits. */
function randomPositiveAmountX100(rng: Rng, width: number): number {
  return Math.max(0.01, randomAmountX100(rng, width));
}

/** A percentage in 1–100 with 0–2 decimals. */
function randomPercent(rng: Rng): number {
  return chance(rng, 0.5) ? randomInt(rng, 1, 100) : randomInt(rng, 100, 10_000) / 100;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** A real ISO calendar date in [fromYear, toYear]. */
export function randomDate(rng: Rng, fromYear = 2000, toYear = 2024): string {
  const year = randomInt(rng, fromYear, toYear);
  const month = randomInt(rng, 1, 12);
  const day = randomInt(rng, 1, daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Splits 100% into `count` shares of at least 1%, in whole percents or in hundredths. */
function dividendShares(rng: Rng, count: number): number[] {
  const unit = chance(rng, 0.5) ? 1 : 100; // hundredths per step
  const steps = 10_000 / unit;
  const minimum = 100 / unit;
  const extra = steps - minimum * count;
  const cuts = Array.from({ length: count - 1 }, () => randomInt(rng, 0, extra)).sort(
    (a, b) => a - b,
  );
  const bounds = [0, ...cuts, extra];
  return Array.from(
    { length: count },
    (_, i) => ((minimum + bounds[i + 1]! - bounds[i]!) * unit) / 100,
  );
}

// ---------------------------------------------------------------------------------------------
// Code-amount sections (driven by the layout)

/** A valid value of `def` (SPEC §3.5, §4.2); `positive` excludes 0. */
function randomCodeValue(rng: Rng, def: CodeDef, positive: boolean): number {
  switch (def.kind) {
    case 'enum':
    case 'rateX100':
      return pick(rng, def.values ?? []).value;
    case 'amountX100':
      return positive || !chance(rng, 0.1) ? randomPositiveAmountX100(rng, def.length) : 0;
    case 'amount':
    case 'num':
      return positive || !chance(rng, 0.1) ? randomPositiveWhole(rng, def.length) : 0;
  }
}

/**
 * Random values for a random subset of `def`'s input codes (derived codes and `exclude` never),
 * at most `max` of them, the required codes always (non-zero unless zeroAllowed). A non-zero-
 * allowed code is sometimes 0, which the generator omits (SPEC §4.5).
 */
function randomCodeAmounts(
  rng: Rng,
  def: RecordDef,
  { exclude = [], max = Infinity }: { exclude?: readonly string[]; max?: number } = {},
): Record<string, number> {
  const candidates = def.codes.filter(code => !code.derived && !exclude.includes(code.code));
  const required = candidates.filter(code => code.required === 'yes');
  const optional = candidates.filter(code => code.required !== 'yes');
  const room = Math.max(0, Math.min(max - required.length, optional.length));
  const count = chance(rng, 0.1) ? room : randomInt(rng, 0, room);
  const amounts: Record<string, number> = {};
  for (const code of [...required, ...sample(rng, optional, count)]) {
    amounts[code.code] = randomCodeValue(rng, code, code.required === 'yes' && !code.zeroAllowed);
  }
  return amounts;
}

function codeDef(def: RecordDef, code: string): CodeDef {
  const found = def.codes.find(candidate => candidate.code === code);
  if (!found) {
    throw new Error(`Record ${def.type} has no code ${code}`);
  }
  return found;
}

// ---------------------------------------------------------------------------------------------
// Report parts

function randomPhone(rng: Rng): Phone {
  return { prefix: pick(rng, PHONE_PREFIXES), number: randomDigits(rng, 7) };
}

function randomPreparer(rng: Rng): PreparerDetails {
  return compact({
    officeName: maybe(rng, () => randomText(rng, 50)),
    contactName: maybe(rng, () => randomText(rng, 50)),
    name: maybe(rng, () => randomText(rng, 50)),
    profession: maybe(rng, () => randomText(rng, 50)),
    licensedDealerNumber: maybe(rng, () => randomId9(rng)),
    address: maybe(rng, () => randomAddress(rng)),
    phone: maybe(rng, () => randomPhone(rng)),
  });
}

function randomRelatedCompany(rng: Rng): RelatedCompany {
  return compact({
    // hebrewText since FIX-2 (SPEC §15 A-29).
    companyName: randomText(rng, 50, true),
    companyFileNumber: maybe(rng, () => randomId9(rng), 0.7),
    relationType: pick(rng, [
      'parent',
      'subsidiary',
      'partnership',
      'kibbutzRelatedCorporation',
      'jointlyControlled',
      'granddaughter',
      'grandmother',
      'other',
    ] as const),
    assessingOfficeCode: maybe(rng, () => randomInt(rng, 0, 99)),
  });
}

function randomRdInvestment(rng: Rng): RdInvestment {
  return compact({
    // hebrewText since FIX-2 (SPEC §15 A-29).
    companyName: randomText(rng, 50, true),
    companyFileNumber: maybe(rng, () => randomId9(rng), 0.7),
    investmentAmount: randomPositiveWhole(rng, 9),
  });
}

const SPECIAL_SHAREHOLDER_IDS = ['999999964', '999999998'];

function randomShareholders(rng: Rng, count: number): Shareholder[] {
  const ids = new Set<string>();
  const shareholders = Array.from({ length: count }, (): Shareholder => {
    let idNumber: string;
    if (chance(rng, 0.05)) {
      idNumber = pick(rng, SPECIAL_SHAREHOLDER_IDS);
    } else {
      do {
        idNumber = randomId9(rng);
      } while (ids.has(idNumber.padStart(9, '0')));
      ids.add(idNumber.padStart(9, '0'));
    }
    return compact({
      idNumber,
      fullName: randomText(rng, 50, true),
      isControllingShareholder: chance(rng, 0.5),
      votingRightsPercent: maybe(rng, () => randomPercent(rng), 0.3),
      otherRightsPercent: maybe(rng, () => randomPercent(rng), 0.2),
      isMaterialShareholder: maybe(rng, () => chance(rng, 0.5), 0.3),
      salaryMonths1To9: maybe(rng, () => randomWhole(rng, 12), 0.3),
      salaryMonths10To12: maybe(rng, () => randomWhole(rng, 12), 0.3),
      otherPayments: maybe(rng, () => randomWhole(rng, 12), 0.2),
    });
  });
  if (count > 0 && chance(rng, 0.8)) {
    // shareholders.dividendRights.total: once anyone states dividend rights, they total 100%.
    const holders = sample(rng, [...shareholders.keys()], randomInt(rng, 1, count));
    const shares = dividendShares(rng, holders.length);
    holders.forEach((holder, i) => {
      shareholders[holder]!.dividendRightsPercent = shares[i]!;
    });
  }
  return shareholders;
}

/** Countries of one breakdown: 1–10 distinct known codes ('-88' only for 439), some unpadded. */
function randomCountries(rng: Rng, code: CountryBreakdownCode): CountryBreakdown['countries'] {
  const pool = COUNTRY_CODES.filter(country => country !== '-88' || code === '439');
  return sample(rng, pool, randomInt(rng, 1, 10)).map(country => ({
    country: (chance(rng, 0.2) && country !== '-88'
      ? country.replace(/^0+(?=\d)/, '')
      : country) as CountryCode,
    income: randomWhole(rng, 12),
  }));
}

function randomForeignAppendix(rng: Rng, def: RecordDef): ForeignAppendix {
  const otherTaxableIncome = maybe(rng, () => randomWhole(rng, 12));
  const taxRefundDeclaration = chance(rng, 0.5);
  const amounts = randomCodeAmounts(rng, def, { max: chance(rng, 0.2) ? Infinity : 12 });
  const breakdowns: Partial<Record<CountryBreakdownCode, CountryBreakdown>> = {};
  for (const [code, value] of Object.entries(amounts)) {
    const codeDefinition = codeDef(def, code);
    // A per-country code written in the section (0 only for the zeroAllowed 442) needs exactly one
    // breakdown (foreign.breakdown.required / orphan, SPEC §15 A-24).
    if (codeDefinition.perCountryBreakdown && (value !== 0 || codeDefinition.zeroAllowed)) {
      const breakdownCode = code as CountryBreakdownCode;
      breakdowns[breakdownCode] = compact({
        deductionsOffsetsAndExemptions: maybe(rng, () => randomWhole(rng, 12)),
        countries: randomCountries(rng, breakdownCode),
      });
    }
  }
  return compact({
    otherTaxableIncomeDescription:
      otherTaxableIncome !== undefined && otherTaxableIncome > 0
        ? randomText(rng, 50)
        : maybe(rng, () => randomText(rng, 50), 0.2),
    otherTaxableIncome,
    foreignTaxPaidOnOtherIncome: maybe(rng, () => randomWhole(rng, 12)),
    totalForeignTaxableIncome: maybe(rng, () => randomWhole(rng, 12)),
    totalForeignLoss: maybe(rng, () => randomWhole(rng, 12)),
    participationExemptionHoldingCompany: maybe(rng, () => randomWhole(rng, 12)),
    taxRefundDeclaration,
    taxRefundDeclarationAmount: taxRefundDeclaration
      ? randomPositiveWhole(rng, 12)
      : maybe(rng, () => randomWhole(rng, 12), 0.2),
    amounts,
    countryBreakdown: Object.keys(breakdowns).length > 0 ? breakdowns : undefined,
  }) as ForeignAppendix;
}

function randomWithholders(rng: Rng): Withholder[] {
  return Array.from({ length: randomInt(rng, 0, 4) }, () =>
    chance(rng, 0.1)
      ? {}
      : compact({
          name: maybe(rng, () => randomText(rng, 30, true), 0.8),
          branch: maybe(rng, () => randomDigits(rng, randomInt(rng, 1, 3)), 0.7),
          account: maybe(rng, () => randomDigits(rng, randomInt(rng, 1, 9)), 0.7),
        }),
  );
}

function randomWallets(rng: Rng): [string] | [string, string] {
  return chance(rng, 0.5)
    ? [randomLatin(rng, 1, 150)]
    : [randomLatin(rng, 1, 150), randomLatin(rng, 1, 150)];
}

function randomImprovement(rng: Rng): Improvement {
  const expense = maybe(rng, () => randomPositiveAmountX100(rng, 12), 0.7);
  // cg.improvements.code50Amount: a code-50 amount needs an expense or a depreciation, and every
  // improvement needs its code-50 amount.
  const accumulatedDepreciation =
    expense === undefined
      ? randomPositiveAmountX100(rng, 12)
      : maybe(rng, () => randomAmountX100(rng, 12));
  return compact({
    expense,
    accumulatedDepreciation,
    date: randomDate(rng),
    code50Amount: randomPositiveAmountX100(rng, 12),
  });
}

function randomLocation(rng: Rng): AssetLocation | undefined {
  return maybe(rng, () => pick(rng, ['abroad', 'israel'] as const));
}

function randomStatus(rng: Rng): WithholdingStatus | undefined {
  return maybe(rng, () => pick(rng, ['notWithheldFirstHalf', 'notWithheldSecondHalf'] as const));
}

function yesNo(rng: Rng): boolean | undefined {
  return maybe(rng, () => chance(rng, 0.5));
}

/** Code-amount pairs in one capital-gains appendix (cg.codePairs.max). */
const CAPITAL_GAINS_CODE_PAIRS = 20;

/** A valid appendix of type `symbol`, with random optional members and codes. */
function randomAppendix(
  rng: Rng,
  symbol: CapitalGainsSymbol,
  def: RecordDef,
): CapitalGainsAppendix {
  // cg.codePairs.max: SHAAM accepts at most 20 pairs in one appendix (SPEC §15 A-30).
  const amounts = randomCodeAmounts(rng, def, { max: CAPITAL_GAINS_CODE_PAIRS });
  switch (symbol) {
    case 27:
      return compact({
        symbol,
        expropriation: yesNo(rng),
        assetDetails: maybe(rng, () => randomText(rng, 50, true)),
        assetLocation: randomLocation(rng),
        relatedParty: yesNo(rng),
        buyerName: maybe(rng, () => randomText(rng, 30)),
        dates: chance(rng, 0.8)
          ? compact({
              code15: maybe(rng, () => randomDate(rng)),
              code20: maybe(rng, () => randomDate(rng)),
              code53: maybe(rng, () => randomDate(rng)),
            })
          : undefined,
        amounts,
      }) as CapitalGainsAppendix;
    case 50:
      return compact({
        symbol,
        expropriation: yesNo(rng),
        assetDetails: maybe(rng, () => randomText(rng, 50, true)),
        purchaseDate: randomDate(rng),
        dates: { code15: randomDate(rng) },
        amounts,
      }) as CapitalGainsAppendix;
    case 51:
      return compact({
        symbol,
        assetDetails: maybe(rng, () => randomText(rng, 50, true)),
        assetLocation: randomLocation(rng),
        relatedParty: yesNo(rng),
        buyerName: maybe(rng, () => randomText(rng, 30, true)),
        dates: { code15: randomDate(rng) },
        walletAddresses: maybe(rng, () => randomWallets(rng)),
        amounts,
      }) as CapitalGainsAppendix;
    case 54:
      return compact({
        symbol,
        assetDetails: maybe(rng, () => randomText(rng, 50, true)),
        purchaseDate: randomDate(rng),
        dates: { code15: randomDate(rng) },
        amounts,
      }) as CapitalGainsAppendix;
    case 60:
    case 64:
    case 65:
      return compact({
        symbol,
        foreignAsset: yesNo(rng),
        soldToRelatedParty: yesNo(rng),
        boughtFromRelatedParty: yesNo(rng),
        // Only the value the PDF lists for the type, or absent (cg.investmentFund.value).
        gainFromInvestmentFund: yesNo(rng) === undefined ? undefined : symbol === 64,
        withholdingStatus: symbol === 65 ? randomStatus(rng) : undefined,
        withholders: maybe(rng, () => randomWithholders(rng), 0.7),
        lossesCarriedForward: maybe(rng, () => randomWhole(rng, 10)),
        amounts,
      }) as CapitalGainsAppendix;
    case 63:
      return compact({
        symbol,
        foreignAsset: yesNo(rng),
        lossesCarriedForward: maybe(rng, () => randomWhole(rng, 10)),
        amounts,
      }) as CapitalGainsAppendix;
    case 66:
      return compact({
        symbol,
        foreignAsset: yesNo(rng),
        withholdingStatus: randomStatus(rng),
        lossesCarriedForward: maybe(rng, () => randomWhole(rng, 10)),
        amounts,
      }) as CapitalGainsAppendix;
    case 77: {
      const virtualCurrency = amounts['071'] === 1;
      return compact({
        symbol,
        expropriation: yesNo(rng),
        assetDetails: maybe(rng, () => randomText(rng, 50)),
        assetLocation: randomLocation(rng),
        relatedParty: yesNo(rng),
        buyerName: maybe(rng, () => randomText(rng, 30)),
        dates: { code15: randomDate(rng), code20: randomDate(rng) },
        improvements: maybe(rng, () =>
          Array.from({ length: randomInt(rng, 0, 5) }, () => randomImprovement(rng)),
        ),
        replacementAsset: maybe(rng, () =>
          compact({
            details: maybe(rng, () => randomText(rng, 50)),
            purchaseDate: maybe(rng, () => randomDate(rng)),
            price: maybe(rng, () => randomPositiveWhole(rng, 10)),
          }),
        ),
        // cg.virtualCurrency.wallet: code 071 = 1 needs a wallet address.
        walletAddresses: virtualCurrency
          ? randomWallets(rng)
          : maybe(rng, () => randomWallets(rng), 0.2),
        amounts,
      }) as CapitalGainsAppendix;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The report

/**
 * A random report that validate1214 accepts with no errors and no warnings. The same seed always
 * yields the same report.
 */
export function randomValidInput(seed: number): Report1214Input {
  const rng = mulberry32(seed);
  const taxYear: SupportedTaxYear = chance(rng, 0.8) ? 2024 : 2025;
  const layout = getLayout(taxYear);
  const records = layout.records;

  // Declarations
  const tookReportablePosition = chance(rng, 0.3);
  const isKibbutz = chance(rng, 0.15);
  const optional = (probability = 0.3) => chance(rng, probability);
  const declarations: Declarations = compact({
    hasTaxPlanningAction: chance(rng, 0.5),
    hadRelatedPartyTransactions: chance(rng, 0.5),
    controlsBodyOfPersons: chance(rng, 0.5),
    holdsRightsInBodyOfPersons: chance(rng, 0.5),
    appliesAccountingStandards: chance(rng, 0.5),
    directorsReceivedOpinion: chance(rng, 0.5),
    tookReportablePosition,
    reportablePositions: tookReportablePosition
      ? Array.from({ length: randomInt(rng, 1, 5) }, () => randomInt(rng, 1, 999))
      : maybe(rng, () => [], 0.1),
    form6111Obligation: optional()
      ? pick(rng, ['obliged', 'notObliged', 'notRelevant'] as const)
      : undefined,
    financialStatementsAttached: optional() ? chance(rng, 0.5) : undefined,
    familyCompany: optional(0.2) ? { representativeFileNumber: randomId9(rng) } : undefined,
    isHouseCompany: optional(0.2) ? chance(rng, 0.5) : undefined,
    form1343Attached: optional() ? chance(rng, 0.5) : undefined,
    form1344Attached: optional() ? chance(rng, 0.5) : undefined,
    preferredEnterprise: optional() ? chance(rng, 0.5) : undefined,
    beneficiaryEnterprise: optional(0.2) ? { noticeDate: randomDate(rng) } : undefined,
    dividendDistributed: optional() ? chance(rng, 0.5) : undefined,
    specialYear: optional(0.2)
      ? { balanceSheetDate: randomDate(rng, taxYear, taxYear) }
      : undefined,
    foreignInvestors: optional() ? chance(rng, 0.5) : undefined,
    consolidatedReport: optional()
      ? pick(rng, ['consolidatedUnderSection23', 'consolidatesWithParent', 'notRelevant'] as const)
      : undefined,
    partnerInPartnership: optional() ? chance(rng, 0.5) : undefined,
    isKibbutz: isKibbutz ? true : optional(0.1) ? false : undefined,
    requestsAdvancePayments: optional() ? chance(rng, 0.5) : undefined,
    hasBuildingIncome: optional(0.2) ? chance(rng, 0.5) : undefined,
    isTrustBeneficiary: optional() ? chance(rng, 0.5) : undefined,
    nonDeductibleSalaryExpenses: optional() ? chance(rng, 0.5) : undefined,
    fewMembersCompany62A: optional() ? chance(rng, 0.5) : undefined,
    partOfMultinationalGroup: optional() ? chance(rng, 0.5) : undefined,
  });

  // Records 1010, 1020, 1030, 2000, 30xx
  const relatedCompanies = chance(rng, 0.4)
    ? Array.from({ length: randomInt(rng, 0, 3) }, () => randomRelatedCompany(rng))
    : undefined;
  const shareholderCount =
    isKibbutz && chance(rng, 0.6)
      ? 0
      : chance(rng, 0.2)
        ? randomInt(rng, 1, 99)
        : randomInt(rng, 1, 5);
  const shareholders = randomShareholders(rng, shareholderCount);
  const rdInvestments = chance(rng, 0.3)
    ? Array.from({ length: randomInt(rng, 0, 5) }, () => randomRdInvestment(rng))
    : undefined;
  const foreignAppendix = chance(rng, 0.35)
    ? randomForeignAppendix(rng, records['2000'])
    : undefined;
  const capitalGainsCount = chance(rng, 0.35) ? 0 : randomInt(rng, 1, 14);
  const capitalGains: CapitalGainsAppendix[] | undefined =
    capitalGainsCount === 0 && chance(rng, 0.7)
      ? undefined
      : Array.from({ length: capitalGainsCount }, () => {
          const symbol = pick(rng, CAPITAL_GAINS_SYMBOLS);
          return randomAppendix(rng, symbol, records[`30${symbol}`]);
        });

  // Capital-gains summary: reasons iff untransmitted appendices, total ≥ all appendices.
  const untransmittedCount = chance(rng, 0.2) ? randomInt(rng, 1, 20) : undefined;
  let capitalGainsSummary: Report1214Input['capitalGainsSummary'];
  if (untransmittedCount !== undefined || chance(rng, 0.2)) {
    const transmitted = (foreignAppendix ? 1 : 0) + capitalGainsCount;
    const minimumTotal = transmitted + (untransmittedCount ?? 0);
    let reasons: NonNullable<Report1214Input['capitalGainsSummary']>['reasons'];
    if (untransmittedCount !== undefined) {
      const marked = sample(
        rng,
        ['lossOrNoGain', 'overFiveImprovementBalances', 'over14Appendices', 'other'] as const,
        randomInt(rng, 1, 4),
      );
      reasons = Object.fromEntries(marked.map(reason => [reason, true]));
      if (marked.includes('other')) {
        reasons.otherText = randomText(rng, 50);
      }
    }
    capitalGainsSummary = compact({
      totalAppendicesCount: maybe(rng, () => randomInt(rng, Math.max(1, minimumTotal), 99)),
      untransmittedCount,
      reasons,
    });
  }

  // Record 1000 header groups
  const attachments = chance(rng, 0.3)
    ? compact({
        donationReceiptsCount: maybe(rng, () => randomInt(rng, 0, 999)),
        withholdingCertificatesCount: maybe(rng, () => randomInt(rng, 0, 999)),
      })
    : undefined;
  const otherTaxableIncome = chance(rng, 0.3)
    ? compact({
        source: maybe(rng, () => randomText(rng, 50, true)),
        amount: maybe(rng, () => randomWhole(rng, 12)),
        ratePercent: maybe(rng, () => randomPercent(rng)),
      })
    : undefined;
  let qualifyingCompany: Report1214Input['qualifyingCompany'];
  if (chance(rng, 0.25)) {
    const purchased = yesNo(rng);
    const amortizationClaimed = yesNo(rng);
    const israeli = maybe(rng, () => randomWhole(rng, 12));
    qualifyingCompany = compact({
      purchased,
      israeliPurchaseAmount: israeli,
      // main.qualifyingCompany.purchaseAmounts: a purchase states at least one positive amount.
      foreignPurchaseAmount:
        purchased && !(israeli !== undefined && israeli > 0)
          ? randomPositiveWhole(rng, 12)
          : maybe(rng, () => randomWhole(rng, 12)),
      amortizationClaimed,
      // main.qualifyingCompany.amortizationAmount (0 is written, SPEC §15 A-21).
      amortizationAmount: amortizationClaimed
        ? randomWhole(rng, 12)
        : maybe(rng, () => randomWhole(rng, 12)),
    });
  }
  const bankAccount = chance(rng, 0.3)
    ? {
        bank: String(randomInt(rng, 1, 99)).padStart(2, '0'),
        branch: randomDigits(rng, 3),
        account: randomDigits(rng, randomInt(rng, 1, 9)),
      }
    : undefined;
  if (!bankAccount && chance(rng, 0.2)) {
    // main.bankAccount.withNoBank: only without a bank account.
    declarations.noBankAccount = chance(rng, 0.5);
  }

  // Record 1000 code-amount section
  const main = records['1000'];
  const conditional = ['080', '084', '226', '259', '165', '070', '010'];
  const amounts = randomCodeAmounts(rng, main, {
    exclude: conditional,
    max: chance(rng, 0.1) ? Infinity : randomInt(rng, 0, 30),
  });
  const required = (code: string) => randomCodeValue(rng, codeDef(main, code), true);
  // main.familyCompany.code080 / main.houseCompany.code084 (0 allowed and written).
  if (declarations.familyCompany || chance(rng, 0.1)) {
    amounts['080'] = chance(rng, 0.3) ? 0 : required('080');
  }
  if (declarations.isHouseCompany || chance(rng, 0.1)) {
    amounts['084'] = chance(rng, 0.3) ? 0 : required('084');
  }
  // main.kibbutz.code226 and main.kibbutz.code226Other (9 is "not a kibbutz").
  if (isKibbutz) {
    amounts['226'] = pick(rng, [1, 2, 3, 4]);
  } else if (chance(rng, 0.1)) {
    amounts['226'] = required('226');
  }
  // main.buildingIncome.code259.
  if (declarations.hasBuildingIncome || chance(rng, 0.1)) {
    amounts['259'] = required('259');
  }
  // main.attachments.code070 / code010: a positive count needs its code.
  if ((attachments?.donationReceiptsCount ?? 0) > 0 || chance(rng, 0.1)) {
    amounts['070'] = required('070');
  }
  if ((attachments?.withholdingCertificatesCount ?? 0) > 0 || chance(rng, 0.1)) {
    amounts['010'] = required('010');
  }
  // main.rd.records / main.rd.total: code 165 is the total of the R&D investments.
  const rdTotal = (rdInvestments ?? []).reduce((sum, rd) => sum + rd.investmentAmount, 0);
  if (rdTotal > 0) {
    amounts['165'] = rdTotal;
  }
  // struct.mainCodePairs.max: at most 61 pairs once the derived codes (SPEC §7.4) are added:
  // 273 always, 008, 028, 297 and the three bank-account codes when their sources call for them.
  const derivedCodes =
    1 +
    (declarations.appliesAccountingStandards ? 1 : 0) +
    (capitalGainsCount > 0 || untransmittedCount !== undefined ? 1 : 0) +
    (declarations.form6111Obligation === 'obliged' ||
    declarations.form6111Obligation === 'notObliged'
      ? 1
      : 0) +
    (bankAccount ? 3 : 0);
  const limit = layout.limits.mainCodePairs - derivedCodes;
  const protectedCodes = new Set([
    ...main.codes.filter(code => code.required === 'yes').map(code => code.code),
    ...conditional,
  ]);
  for (const code of shuffle(rng, Object.keys(amounts))) {
    if (Object.keys(amounts).length <= limit) {
      break;
    }
    if (!protectedCodes.has(code)) {
      delete amounts[code];
    }
  }
  // main.investmentLaw.flag: code 101 or 102 needs 849.
  if (amounts['101'] !== undefined || amounts['102'] !== undefined) {
    declarations.claimsCapitalInvestmentLawBenefits = true;
  } else if (chance(rng, 0.2)) {
    declarations.claimsCapitalInvestmentLawBenefits = chance(rng, 0.5);
  }
  // 833: an explicit answer that agrees with the appendices (main.capitalGains.flag).
  if (chance(rng, 0.2)) {
    declarations.hasCapitalGainsAppendix =
      capitalGainsCount > 0 || untransmittedCount !== undefined ? true : chance(rng, 0.5);
  }

  const fileNumber = randomId9(rng);
  const report: Report1214Input = compact({
    taxYear,
    meta: chance(rng, 0.5)
      ? compact({
          softwareName: maybe(rng, () => randomText(rng, 15)),
          saveDate: maybe(rng, () => randomDate(rng, taxYear + 1, taxYear + 1)),
        })
      : undefined,
    company: compact({
      fileNumber,
      registeredName: randomText(rng, 50),
      // main.withholdingFile.companyNumber: derived from the company file number (SPEC §15 A-28).
      withholdingFileNumber: maybe(rng, () => expectedWithholdingFileNumber(fileNumber)),
      vatFileNumber: maybe(rng, () => randomId9(rng)),
      occupationDescription: maybe(rng, () => randomText(rng, 50)),
      mailingAddress: randomAddress(rng),
      businessAddress: randomAddress(rng),
      booksAddress: maybe(rng, () => randomAddress(rng)),
      email: maybe(rng, () => `${randomLatin(rng, 1, 20)}@${randomLatin(rng, 1, 20)}.co.il`),
      phone: randomPhone(rng),
      fax: maybe(rng, () => randomPhone(rng)),
    }),
    preparer: chance(rng, 0.4) ? randomPreparer(rng) : undefined,
    declarations,
    otherTaxableIncome,
    attachments,
    capitalGainsSummary,
    qualifyingCompany,
    bankAccount,
    amounts,
    relatedCompanies,
    shareholders,
    rdInvestments,
    foreignAppendix,
    capitalGains,
  }) as Report1214Input;
  return report;
}
