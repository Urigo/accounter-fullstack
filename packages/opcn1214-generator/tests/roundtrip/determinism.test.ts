/**
 * Determinism (SPEC §8.3, §13.6): the bytes depend only on the input values and the save date.
 * Object key order, `amounts` insertion order and explicitly undefined optional members never
 * change the output, and a fixed `today` makes a report without `meta.saveDate` stable.
 */
import { generate1214, type GenerateOptions, type Report1214Input } from '../../src/index.js';
import { minimalInput } from '../fixtures/builders.js';
import { mulberry32, randomValidInput, shuffle, type Rng } from '../fixtures/random.js';

const OPTIONS: GenerateOptions = { today: () => '2025-06-30' };
const SEEDS = Array.from({ length: 25 }, (_, index) => 1000 + index);
const TIMEOUT_MS = 60_000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A deep copy of `value` whose objects (amount maps included) have their keys in random order. */
function shuffleKeys(rng: Rng, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => shuffleKeys(rng, item));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  return Object.fromEntries(
    shuffle(rng, Object.keys(value)).map(key => [key, shuffleKeys(rng, value[key])]),
  );
}

/** A deep copy of `value` whose `amounts` maps are rebuilt in reverse, then random, order. */
function shuffleAmounts(rng: Rng, value: unknown, key = ''): unknown {
  if (Array.isArray(value)) {
    return value.map(item => shuffleAmounts(rng, item));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const entries = Object.entries(value).map(
    ([name, member]) => [name, shuffleAmounts(rng, member, name)] as const,
  );
  return Object.fromEntries(key === 'amounts' ? shuffle(rng, entries.reverse()) : entries);
}

/** Optional members of each object of the input (SPEC §7.2), by the object's path shape. */
const OPTIONAL_MEMBERS: Readonly<Record<string, readonly string[]>> = {
  '': [
    'meta',
    'preparer',
    'otherTaxableIncome',
    'attachments',
    'capitalGainsSummary',
    'qualifyingCompany',
    'bankAccount',
    'relatedCompanies',
    'rdInvestments',
    'foreignAppendix',
    'capitalGains',
  ],
  meta: ['softwareName', 'saveDate'],
  company: [
    'withholdingFileNumber',
    'vatFileNumber',
    'occupationDescription',
    'booksAddress',
    'email',
    'fax',
  ],
  preparer: [
    'officeName',
    'contactName',
    'name',
    'profession',
    'licensedDealerNumber',
    'address',
    'phone',
  ],
  declarations: [
    'reportablePositions',
    'form6111Obligation',
    'financialStatementsAttached',
    'familyCompany',
    'isHouseCompany',
    'isKibbutz',
    'requestsAdvancePayments',
    'noBankAccount',
    'hasCapitalGainsAppendix',
  ],
  otherTaxableIncome: ['source', 'amount', 'ratePercent'],
  'relatedCompanies[]': ['companyFileNumber', 'assessingOfficeCode'],
  'shareholders[]': [
    'dividendRightsPercent',
    'votingRightsPercent',
    'otherRightsPercent',
    'isMaterialShareholder',
    'salaryMonths1To9',
    'salaryMonths10To12',
    'otherPayments',
  ],
  'rdInvestments[]': ['companyFileNumber'],
  foreignAppendix: [
    'otherTaxableIncomeDescription',
    'otherTaxableIncome',
    'taxRefundDeclarationAmount',
    'countryBreakdown',
  ],
  'capitalGains[]': ['lossesCarriedForward', 'walletAddresses', 'buyerName', 'assetDetails'],
};

/**
 * A deep copy of `value` with every absent optional member of OPTIONAL_MEMBERS present and
 * explicitly `undefined` (members that do not belong to an appendix's type are left out).
 */
function withExplicitUndefined(value: unknown, shape = ''): unknown {
  if (Array.isArray(value)) {
    return value.map(item => withExplicitUndefined(item, `${shape}[]`));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const copy: Record<string, unknown> = {};
  for (const [key, member] of Object.entries(value)) {
    copy[key] = withExplicitUndefined(member, shape === '' ? key : `${shape}.${key}`);
  }
  for (const key of OPTIONAL_MEMBERS[shape] ?? []) {
    if (!(key in copy) && memberBelongs(value, shape, key)) {
      copy[key] = undefined;
    }
  }
  return copy;
}

/** Appendix members exist only on some symbols (the zod schema is strict per symbol). */
function memberBelongs(object: Record<string, unknown>, shape: string, key: string): boolean {
  if (shape !== 'capitalGains[]') {
    return true;
  }
  const symbol = object['symbol'];
  switch (key) {
    case 'lossesCarriedForward':
      return [60, 63, 64, 65, 66].includes(symbol as number);
    case 'walletAddresses':
      return symbol === 51 || symbol === 77;
    case 'buyerName':
      return [27, 51, 77].includes(symbol as number);
    case 'assetDetails':
      return [27, 50, 51, 54, 77].includes(symbol as number);
    default:
      return false;
  }
}

function bytesOf(input: unknown, options: GenerateOptions = OPTIONS): Uint8Array {
  return generate1214(input as Report1214Input, options).bytes;
}

describe('determinism', () => {
  it.each(SEEDS)(
    'seed %i: shuffled object keys give identical bytes',
    seed => {
      const input = randomValidInput(seed);
      const shuffled = shuffleKeys(mulberry32(seed), input);
      expect(JSON.stringify(shuffled)).not.toBe(JSON.stringify(input));
      expect(bytesOf(shuffled)).toEqual(bytesOf(input));
    },
    TIMEOUT_MS,
  );

  it.each(SEEDS)(
    'seed %i: shuffled amounts insertion order gives identical bytes',
    seed => {
      const input = randomValidInput(seed);
      expect(bytesOf(shuffleAmounts(mulberry32(seed), input))).toEqual(bytesOf(input));
    },
    TIMEOUT_MS,
  );

  it.each(SEEDS)(
    'seed %i: explicitly undefined optional members give identical bytes',
    seed => {
      const input = randomValidInput(seed);
      const explicit = withExplicitUndefined(input);
      expect(Object.values(explicit as object)).toContain(undefined);
      expect(bytesOf(explicit)).toEqual(bytesOf(input));
    },
    TIMEOUT_MS,
  );

  it('orders the amounts of record 1000 by code whatever their insertion order', () => {
    const ascending = minimalInput({ amounts: { '010': 5, '070': 6, '121': 7 } });
    const descending = minimalInput();
    descending.amounts = Object.fromEntries(
      Object.entries(ascending.amounts).reverse(),
    ) as Report1214Input['amounts'];
    expect(Object.keys(descending.amounts)).not.toEqual(Object.keys(ascending.amounts));
    expect(bytesOf(descending)).toEqual(bytesOf(ascending));
  });

  it('uses options.today when meta.saveDate is absent, and is stable for a fixed today', () => {
    const input = minimalInput();
    const first = bytesOf(input);
    expect(bytesOf(input)).toEqual(first);
    expect(generate1214(input, OPTIONS).text.slice(164, 174)).toBe('30/06/2025');
    expect(bytesOf(minimalInput({ meta: { saveDate: '2025-06-30' } }), {})).toEqual(first);
    expect(bytesOf(input, { today: () => '2025-07-01' })).not.toEqual(first);
  });
});
