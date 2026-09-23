import { describe, expect, it } from 'vitest';
import type { IGetLedgerRecordsByChargesIdsResult } from '../../../ledger/types.js';
import { hashLedgerFingerprint, ledgerFingerprintTuple } from '../ledger-fingerprint.helper.js';

const ENTITY = '00000000-0000-0000-0000-00000000000a';
const OTHER_1 = '00000000-0000-0000-0000-00000000000b';
const OTHER_2 = '00000000-0000-0000-0000-00000000000c';

function makeRecord(
  overrides: Partial<IGetLedgerRecordsByChargesIdsResult> = {},
): IGetLedgerRecordsByChargesIdsResult {
  return {
    id: 'record-1',
    charge_id: 'charge-1',
    owner_id: 'owner-1',
    credit_entity1: ENTITY,
    credit_entity2: null,
    credit_local_amount1: '100',
    credit_local_amount2: null,
    credit_foreign_amount1: '30',
    credit_foreign_amount2: null,
    debit_entity1: OTHER_1,
    debit_entity2: null,
    debit_local_amount1: '100',
    debit_local_amount2: null,
    debit_foreign_amount1: '30',
    debit_foreign_amount2: null,
    currency: 'USD',
    invoice_date: new Date(2026, 0, 15),
    value_date: new Date(2026, 0, 20),
    description: 'some description',
    reference1: 'ref-1',
    ...overrides,
  } as IGetLedgerRecordsByChargesIdsResult;
}

function hashOf(record: IGetLedgerRecordsByChargesIdsResult, entityId = ENTITY): string {
  return hashLedgerFingerprint([ledgerFingerprintTuple(record, entityId, 'credit', 1)]);
}

describe('ledgerFingerprintTuple / hashLedgerFingerprint', () => {
  it('does not depend on tuple order', () => {
    const a = ledgerFingerprintTuple(makeRecord(), ENTITY, 'credit', 1);
    const b = ledgerFingerprintTuple(makeRecord({ charge_id: 'charge-2' }), ENTITY, 'credit', 1);
    expect(hashLedgerFingerprint([a, b])).toBe(hashLedgerFingerprint([b, a]));
  });

  it('ignores the record id', () => {
    expect(hashOf(makeRecord({ id: 'record-1' }))).toBe(hashOf(makeRecord({ id: 'record-2' })));
  });

  it('ignores description and reference1', () => {
    const base = hashOf(makeRecord());
    expect(hashOf(makeRecord({ description: 'changed' }))).toBe(base);
    expect(hashOf(makeRecord({ reference1: 'changed' }))).toBe(base);
  });

  describe('changes the hash when a tracked field changes', () => {
    const base = hashOf(makeRecord());

    it.each<[string, Partial<IGetLedgerRecordsByChargesIdsResult>]>([
      ['local amount', { credit_local_amount1: '101' }],
      ['foreign amount', { credit_foreign_amount1: '31' }],
      ['currency', { currency: 'EUR' }],
      ['invoice_date', { invoice_date: new Date(2026, 0, 16) }],
      ['value_date', { value_date: new Date(2026, 0, 21) }],
      ['counter-entity', { debit_entity1: OTHER_2 }],
    ])('%s', (_, overrides) => {
      expect(hashOf(makeRecord(overrides))).not.toBe(base);
    });

    it('side', () => {
      const record = makeRecord({ debit_local_amount1: '100', debit_foreign_amount1: '30' });
      expect(
        hashLedgerFingerprint([ledgerFingerprintTuple(record, ENTITY, 'debit', 1)]),
      ).not.toBe(base);
    });

    it('slot', () => {
      const record = makeRecord({ credit_local_amount2: '100', credit_foreign_amount2: '30' });
      expect(
        hashLedgerFingerprint([ledgerFingerprintTuple(record, ENTITY, 'credit', 2)]),
      ).not.toBe(base);
    });
  });

  it('normalizes amounts to 2 decimals', () => {
    const a = ledgerFingerprintTuple(
      makeRecord({ credit_local_amount1: '100', credit_foreign_amount1: '30' }),
      ENTITY,
      'credit',
      1,
    );
    const b = ledgerFingerprintTuple(
      makeRecord({ credit_local_amount1: '100.00', credit_foreign_amount1: '30.0' }),
      ENTITY,
      'credit',
      1,
    );
    expect(a).toBe(b);
  });

  it('renders a null foreign amount as an empty field', () => {
    const tuple = ledgerFingerprintTuple(
      makeRecord({ credit_foreign_amount1: null }),
      ENTITY,
      'credit',
      1,
    );
    expect(tuple.split('|')[4]).toBe('');
  });

  it('lists other-side entity ids sorted, de-duplicated, and without the entity itself', () => {
    const record = makeRecord({ debit_entity1: OTHER_2, debit_entity2: OTHER_1 });
    const tuple = ledgerFingerprintTuple(record, ENTITY, 'credit', 1);
    expect(tuple.split('|').at(-1)).toBe(`${OTHER_1},${OTHER_2}`);

    const duplicated = makeRecord({ debit_entity1: OTHER_1, debit_entity2: OTHER_1 });
    expect(ledgerFingerprintTuple(duplicated, ENTITY, 'credit', 1).split('|').at(-1)).toBe(
      OTHER_1,
    );

    const selfOnOtherSide = makeRecord({ debit_entity1: ENTITY, debit_entity2: OTHER_1 });
    expect(ledgerFingerprintTuple(selfOnOtherSide, ENTITY, 'credit', 1).split('|').at(-1)).toBe(
      OTHER_1,
    );
  });

  it('formats dates as YYYY-MM-DD', () => {
    const fields = ledgerFingerprintTuple(makeRecord(), ENTITY, 'credit', 1).split('|');
    expect(fields[6]).toBe('2026-01-15');
    expect(fields[7]).toBe('2026-01-20');
  });

  it('returns a 64-char lowercase hex string', () => {
    expect(hashOf(makeRecord())).toMatch(/^[0-9a-f]{64}$/);
    expect(hashLedgerFingerprint([])).toMatch(/^[0-9a-f]{64}$/);
  });
});
