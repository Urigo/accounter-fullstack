import { describe, expect, it } from 'vitest';
import type { LedgerRecordInput } from '../../../../__generated__/types.js';
import { Currency } from '../../../../shared/enums.js';
import { ledgerRecordInputToParams } from '../manual-ledger-record.helper.js';

/* All IDs, amounts and dates below are made up. */

const MINIMAL_INPUT: LedgerRecordInput = {
  debitEntity1: 'debit-entity-1',
  debitLocalAmount1: 100,
  creditEntity1: 'credit-entity-1',
  creditLocalAmount1: 100,
  currency: Currency.Ils,
  invoiceDate: '2025-03-12',
  valueDate: '2025-03-14',
};

describe('ledgerRecordInputToParams', () => {
  it('maps every input field to its column param', () => {
    const params = ledgerRecordInputToParams({
      debitEntity1: 'debit-entity-1',
      debitLocalAmount1: 370,
      debitForeignAmount1: 100,
      creditEntity1: 'credit-entity-1',
      creditLocalAmount1: 314,
      creditForeignAmount1: 85,
      debitEntity2: 'debit-entity-2',
      debitLocalAmount2: 0.5,
      debitForeignAmount2: 0.1,
      creditEntity2: 'credit-entity-2',
      creditLocalAmount2: 56.5,
      creditForeignAmount2: 15.1,
      currency: Currency.Usd,
      invoiceDate: '2025-03-12',
      valueDate: '2025-03-14',
      description: 'Manual record',
      reference: 'REF-1',
    });

    expect(params).toEqual({
      debitEntity1: 'debit-entity-1',
      debitLocalAmount1: 370,
      debitForeignAmount1: 100,
      creditEntity1: 'credit-entity-1',
      creditLocalAmount1: 314,
      creditForeignAmount1: 85,
      debitEntity2: 'debit-entity-2',
      debitLocalAmount2: 0.5,
      debitForeignAmount2: 0.1,
      creditEntity2: 'credit-entity-2',
      creditLocalAmount2: 56.5,
      creditForeignAmount2: 15.1,
      currency: Currency.Usd,
      invoiceDate: '2025-03-12',
      valueDate: '2025-03-14',
      description: 'Manual record',
      reference: 'REF-1',
    });
  });

  it('turns absent optional fields into null, so an update clears them', () => {
    const params = ledgerRecordInputToParams(MINIMAL_INPUT);

    expect(params).toEqual({
      debitEntity1: 'debit-entity-1',
      debitLocalAmount1: 100,
      debitForeignAmount1: null,
      creditEntity1: 'credit-entity-1',
      creditLocalAmount1: 100,
      creditForeignAmount1: null,
      debitEntity2: null,
      debitLocalAmount2: null,
      debitForeignAmount2: null,
      creditEntity2: null,
      creditLocalAmount2: null,
      creditForeignAmount2: null,
      currency: Currency.Ils,
      invoiceDate: '2025-03-12',
      valueDate: '2025-03-14',
      description: null,
      reference: null,
    });
  });

  it('turns explicit null optional fields into null', () => {
    const params = ledgerRecordInputToParams({
      ...MINIMAL_INPUT,
      debitForeignAmount1: null,
      creditEntity2: null,
      creditLocalAmount2: null,
      description: null,
      reference: null,
    });

    expect(params.debitForeignAmount1).toBeNull();
    expect(params.creditEntity2).toBeNull();
    expect(params.creditLocalAmount2).toBeNull();
    expect(params.description).toBeNull();
    expect(params.reference).toBeNull();
  });

  it('does not set the charge, owner or lock of the record', () => {
    const params = ledgerRecordInputToParams(MINIMAL_INPUT);

    expect(params).not.toHaveProperty('chargeId');
    expect(params).not.toHaveProperty('ownerId');
    expect(params).not.toHaveProperty('locked');
  });
});
