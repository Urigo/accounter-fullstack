import { describe, expect, it } from 'vitest';
import {
  pairCreditCardRestatements,
  RESTATEMENT_DATE_TOLERANCE_DAYS,
  type CreditCardDeal,
} from '../otsar-hahayal-restatement.helper.js';

type Stored = CreditCardDeal & { id: string };
type Incoming = CreditCardDeal & { ref: string };

const base: CreditCardDeal = {
  resourceId: 'card-1',
  cardType: 9,
  date: '2024-03-10',
  chargeDate: '2024-04-02',
  name: 'ACME CLOUD SER',
  dealAmount: 42.5,
  dealCurrency: 'USD',
  chargeAmount: 42.5,
  chargeCurrency: 'USD',
  notes: '',
  counter: 0,
};

const stored = (id: string, overrides: Partial<CreditCardDeal> = {}): Stored => ({
  ...base,
  ...overrides,
  id,
});

/** The bank's restatement of a provisional deal: a day earlier, full name, notes filled in. */
const restated = (ref: string, overrides: Partial<CreditCardDeal> = {}): Incoming => ({
  ...base,
  date: '2024-03-09',
  name: 'Acme Cloud Services',
  notes: 'standing order, US',
  ...overrides,
  ref,
});

const pairIds = (result: ReturnType<typeof pairCreditCardRestatements<Stored, Incoming>>) =>
  result.pairs.map(({ stored: s, incoming: i }) => [s.id, i.ref]);

describe('pairCreditCardRestatements', () => {
  it('pairs a restated deal with its provisional stored row', () => {
    const result = pairCreditCardRestatements([stored('s1')], [restated('i1')]);
    expect(pairIds(result)).toEqual([['s1', 'i1']]);
    expect(result.vanished).toEqual([]);
  });

  it('pairs when only the date and notes changed (name already complete)', () => {
    const result = pairCreditCardRestatements(
      [stored('s1', { name: 'ACME' })],
      [restated('i1', { name: 'ACME' })],
    );
    expect(pairIds(result)).toEqual([['s1', 'i1']]);
  });

  it('ignores deals that match a stored row exactly', () => {
    const result = pairCreditCardRestatements([stored('s1')], [{ ...base, ref: 'i1' }]);
    expect(result.pairs).toEqual([]);
    expect(result.vanished).toEqual([]);
  });

  it('never touches a stored row that is still in the scrape', () => {
    // Two genuine same-merchant, same-amount deals on adjacent days: both scraped again unchanged,
    // plus a new deal that looks like a restatement of either.
    const s1 = stored('s1', { date: '2024-03-10' });
    const s2 = stored('s2', { date: '2024-03-11' });
    const result = pairCreditCardRestatements(
      [s1, s2],
      [
        { ...s1, ref: 'again-1' },
        { ...s2, ref: 'again-2' },
        restated('new', { date: '2024-03-10' }),
      ],
    );
    expect(result.pairs).toEqual([]);
  });

  it('does not pair when the stored name is not a prefix of the incoming one', () => {
    const result = pairCreditCardRestatements(
      [stored('s1', { name: 'OTHER VENDOR' })],
      [restated('i1')],
    );
    expect(result.pairs).toEqual([]);
    expect(result.vanished.map(s => s.id)).toEqual(['s1']);
  });

  it.each<[string, Partial<CreditCardDeal>]>([
    ['deal amount', { dealAmount: 43 }],
    ['charge amount', { chargeAmount: 43 }],
    ['deal currency', { dealCurrency: 'EUR' }],
    ['charge currency', { chargeCurrency: 'ILS' }],
    ['charge date', { chargeDate: '2024-05-02' }],
    ['card', { resourceId: 'card-2' }],
  ])('does not pair across a different %s', (_label, overrides) => {
    const result = pairCreditCardRestatements([stored('s1')], [restated('i1', overrides)]);
    expect(result.pairs).toEqual([]);
  });

  it('does not pair beyond the date tolerance', () => {
    expect(RESTATEMENT_DATE_TOLERANCE_DAYS).toBe(3);
    const within = pairCreditCardRestatements(
      [stored('s1', { date: '2024-03-10' })],
      [restated('i1', { date: '2024-03-07' })],
    );
    expect(within.pairs).toHaveLength(1);
    const beyond = pairCreditCardRestatements(
      [stored('s1', { date: '2024-03-10' })],
      [restated('i1', { date: '2024-03-06' })],
    );
    expect(beyond.pairs).toEqual([]);
  });

  it('pairs a run of the same daily charge each with its own day', () => {
    // Stored provisional deals on the 10th..13th; restated each one day back (9th..12th).
    // A nearest-date pairing would match stored 10th with restated 10th (really the 11th's).
    const days = [10, 11, 12, 13];
    const storedRows = days.map(d => stored(`s${d}`, { date: `2024-03-${d}` }));
    const incoming = days.map(d => restated(`i${d}`, { date: `2024-03-${String(d - 1).padStart(2, '0')}` }));
    const result = pairCreditCardRestatements(storedRows, incoming);
    expect(pairIds(result).sort()).toEqual(days.map(d => [`s${d}`, `i${d}`]).sort());
  });

  it('pairs one-to-one and leaves a genuinely new deal unpaired', () => {
    const result = pairCreditCardRestatements(
      [stored('s1')],
      [restated('i1'), restated('i2', { date: '2024-03-08' })],
    );
    expect(pairIds(result)).toEqual([['s1', 'i1']]);
  });

  it('pairs identical twins one-to-one', () => {
    const result = pairCreditCardRestatements(
      [stored('s1'), stored('s2', { counter: 1 })],
      [restated('i1'), restated('i2', { counter: 1 })],
    );
    expect(result.pairs).toHaveLength(2);
    expect(new Set(result.pairs.map(p => p.stored.id))).toEqual(new Set(['s1', 's2']));
    expect(new Set(result.pairs.map(p => p.incoming.ref))).toEqual(new Set(['i1', 'i2']));
  });

  it('reports a stored row missing from its scraped statement as vanished', () => {
    // e.g. a fee the bank split into fee + discount: no 1:1 restatement exists
    const result = pairCreditCardRestatements(
      [stored('fee', { name: 'CARD FEE', chargeAmount: 15, dealAmount: 24 })],
      [
        restated('fee-full', { name: 'Card fee, full', chargeAmount: 24, dealAmount: 24 }),
        restated('discount', { name: 'Card fee discount', chargeAmount: -9, dealAmount: 0 }),
      ],
    );
    expect(result.pairs).toEqual([]);
    expect(result.vanished.map(s => s.id)).toEqual(['fee']);
  });

  it('ignores stored rows of statements not in this scrape', () => {
    const result = pairCreditCardRestatements(
      [stored('old-statement', { chargeDate: '2024-03-02' })],
      [restated('i1')],
    );
    expect(result.pairs).toEqual([]);
    expect(result.vanished).toEqual([]);
  });
});
