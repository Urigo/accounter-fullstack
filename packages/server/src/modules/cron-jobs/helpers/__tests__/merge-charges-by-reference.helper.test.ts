import { describe, expect, it } from 'vitest';
import type { IGetChargesByIdsResult } from '../../../charges/types.js';
import type { IGetReferenceMergeCandidatesResult } from '../../types.js';
import { buildMergeChargesByTransactionReferencePlan } from '../merge-charges-by-reference.helper.js';

function buildCharge(
  id: string,
  overrides: Partial<IGetChargesByIdsResult> = {},
): IGetChargesByIdsResult {
  return {
    id,
    accountant_status: 'PENDING',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    documents_optional_flag: false,
    invoice_payment_currency_diff: null,
    is_property: false,
    optional_vat: false,
    owner_id: 'owner-1',
    tax_category_id: null,
    type: 'COMMON',
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    user_description: null,
    ...overrides,
  };
}

function buildCandidate(
  id: string,
  chargeId: string,
  reference: string,
  eventDate: string,
  overrides: Partial<IGetReferenceMergeCandidatesResult> = {},
): IGetReferenceMergeCandidatesResult {
  return {
    id,
    account_id: 'account-1',
    amount: '10.00',
    business_id: null,
    charge_id: chargeId,
    counter_account: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    currency: 'ILS',
    currency_rate: '1',
    current_balance: '0',
    debit_date: null,
    debit_date_override: null,
    debit_timestamp: null,
    event_date: new Date(eventDate),
    is_fee: false,
    origin_key: 'origin-key',
    origin_user_description: null,
    owner_id: 'owner-1',
    source_description: null,
    source_id: `source-${id}`,
    source_origin: 'POALIM_ILS',
    source_reference: reference,
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildChargeById(charges: IGetChargesByIdsResult[]) {
  return new Map(charges.map(charge => [charge.id, charge]));
}

describe('buildMergeChargesByTransactionReferencePlan', () => {
  it('builds separate plans for disconnected candidate clusters', () => {
    const charges = [
      buildCharge('charge-a', { created_at: new Date('2026-01-01T00:00:00.000Z') }),
      buildCharge('charge-b', { created_at: new Date('2026-01-02T00:00:00.000Z') }),
      buildCharge('charge-c', { created_at: new Date('2026-01-03T00:00:00.000Z') }),
      buildCharge('charge-d', { created_at: new Date('2026-01-04T00:00:00.000Z') }),
    ];
    const candidates = [
      buildCandidate('tx-a', 'charge-a', 'REF-1', '2026-01-01T10:00:00.000Z'),
      buildCandidate('tx-b', 'charge-b', 'REF-1', '2026-01-01T14:00:00.000Z'),
      buildCandidate('tx-c', 'charge-c', 'REF-1', '2026-03-15T10:00:00.000Z'),
      buildCandidate('tx-d', 'charge-d', 'REF-1', '2026-03-15T14:00:00.000Z'),
    ];

    const result = buildMergeChargesByTransactionReferencePlan({
      candidates,
      chargeById: buildChargeById(charges),
    });

    expect(result.errors).toEqual([]);
    expect(result.plans).toEqual([
      {
        reference: 'REF-1',
        baseChargeId: 'charge-a',
        chargeIdsToMerge: ['charge-b'],
      },
      {
        reference: 'REF-1',
        baseChargeId: 'charge-c',
        chargeIdsToMerge: ['charge-d'],
      },
    ]);
  });

  it('matches candidates by wide date window when descriptions contain each other', () => {
    const charges = [
      buildCharge('charge-a', { created_at: new Date('2026-01-01T00:00:00.000Z') }),
      buildCharge('charge-b', { created_at: new Date('2026-01-02T00:00:00.000Z') }),
    ];
    const candidates = [
      buildCandidate('tx-a', 'charge-a', 'REF-2', '2026-01-01T10:00:00.000Z', {
        source_description: 'payment for vendor abc',
      }),
      buildCandidate('tx-b', 'charge-b', 'REF-2', '2026-01-20T10:00:00.000Z', {
        source_description: 'vendor abc',
      }),
    ];

    const result = buildMergeChargesByTransactionReferencePlan({
      candidates,
      chargeById: buildChargeById(charges),
    });

    expect(result.errors).toEqual([]);
    expect(result.plans).toEqual([
      {
        reference: 'REF-2',
        baseChargeId: 'charge-a',
        chargeIdsToMerge: ['charge-b'],
      },
    ]);
  });

  it('prefers a non-fee charge as the merge base', () => {
    const charges = [
      buildCharge('charge-fee', {
        created_at: new Date('2026-01-01T00:00:00.000Z'),
      }),
      buildCharge('charge-main', {
        created_at: new Date('2026-01-02T00:00:00.000Z'),
      }),
    ];
    const candidates = [
      buildCandidate('tx-fee', 'charge-fee', 'REF-3', '2026-01-01T10:00:00.000Z', {
        is_fee: true,
      }),
      buildCandidate('tx-main', 'charge-main', 'REF-3', '2026-01-01T12:00:00.000Z', {
        is_fee: false,
      }),
    ];

    const result = buildMergeChargesByTransactionReferencePlan({
      candidates,
      chargeById: buildChargeById(charges),
    });

    expect(result.errors).toEqual([]);
    expect(result.plans).toEqual([
      {
        reference: 'REF-3',
        baseChargeId: 'charge-main',
        chargeIdsToMerge: ['charge-fee'],
      },
    ]);
  });

  it('keeps the first assignment when a target charge appears in multiple plans', () => {
    const charges = [
      buildCharge('charge-main-1', { created_at: new Date('2026-01-01T00:00:00.000Z') }),
      buildCharge('charge-main-2', { created_at: new Date('2026-01-03T00:00:00.000Z') }),
      buildCharge('charge-target', {
        created_at: new Date('2026-01-02T00:00:00.000Z'),
        user_description: 'unlinked from charge',
      }),
    ];
    const candidates = [
      buildCandidate('tx-1', 'charge-main-1', 'REF-4', '2026-01-01T10:00:00.000Z'),
      buildCandidate('tx-2', 'charge-target', 'REF-4', '2026-01-01T11:00:00.000Z', {
        is_fee: true,
      }),
      buildCandidate('tx-3', 'charge-main-2', 'REF-5', '2026-01-02T10:00:00.000Z'),
      buildCandidate('tx-4', 'charge-target', 'REF-5', '2026-01-02T11:00:00.000Z', {
        is_fee: true,
      }),
    ];

    const result = buildMergeChargesByTransactionReferencePlan({
      candidates,
      chargeById: buildChargeById(charges),
    });

    expect(result.plans).toEqual([
      {
        reference: 'REF-4',
        baseChargeId: 'charge-main-1',
        chargeIdsToMerge: ['charge-target'],
      },
    ]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('charge-target');
  });

  it('does not merge recurring monthly payments with identical details', () => {
    const charges = [
      buildCharge('charge-june', { created_at: new Date('2026-06-01T00:00:00.000Z') }),
      buildCharge('charge-july', { created_at: new Date('2026-07-01T00:00:00.000Z') }),
    ];
    const candidates = [
      buildCandidate('tx-june', 'charge-june', 'REF-6', '2026-06-01T10:00:00.000Z', {
        amount: '-2500.00',
        source_description: 'standing order recurring service payment',
      }),
      buildCandidate('tx-july', 'charge-july', 'REF-6', '2026-07-01T10:00:00.000Z', {
        amount: '-2500.00',
        source_description: 'standing order recurring service payment',
      }),
    ];

    const result = buildMergeChargesByTransactionReferencePlan({
      candidates,
      chargeById: buildChargeById(charges),
    });

    expect(result.errors).toEqual([]);
    expect(result.plans).toEqual([]);
  });

  it('does not merge distinct same-reference income payments with different amounts', () => {
    const charges = [
      buildCharge('charge-income-1', { created_at: new Date('2026-04-19T00:00:00.000Z') }),
      buildCharge('charge-income-2', { created_at: new Date('2026-04-25T00:00:00.000Z') }),
    ];
    const candidates = [
      buildCandidate('tx-income-1', 'charge-income-1', 'REF-7', '2026-04-19T10:00:00.000Z', {
        currency: 'EUR',
        amount: '1000.00',
        source_description: 'incoming transfer from customer alpha',
      }),
      buildCandidate('tx-income-2', 'charge-income-2', 'REF-7', '2026-04-25T10:00:00.000Z', {
        currency: 'EUR',
        amount: '1100.00',
        source_description: 'incoming transfer from customer alpha',
      }),
    ];

    const result = buildMergeChargesByTransactionReferencePlan({
      candidates,
      chargeById: buildChargeById(charges),
    });

    expect(result.errors).toEqual([]);
    expect(result.plans).toEqual([]);
  });

  it('merges same-day principal and interest records under one reference', () => {
    const charges = [
      buildCharge('charge-interest', { created_at: new Date('2026-07-06T00:00:00.000Z') }),
      buildCharge('charge-principal', { created_at: new Date('2026-07-06T00:00:01.000Z') }),
    ];
    const candidates = [
      buildCandidate('tx-interest', 'charge-interest', 'REF-8', '2026-07-06T10:00:00.000Z', {
        amount: '0.02',
        source_description: 'deposit interest credit',
      }),
      buildCandidate('tx-principal', 'charge-principal', 'REF-8', '2026-07-06T10:00:00.000Z', {
        amount: '395.04',
        source_description: 'deposit withdrawal principal',
      }),
    ];

    const result = buildMergeChargesByTransactionReferencePlan({
      candidates,
      chargeById: buildChargeById(charges),
    });

    expect(result.errors).toEqual([]);
    expect(result.plans).toEqual([
      {
        reference: 'REF-8',
        baseChargeId: 'charge-interest',
        chargeIdsToMerge: ['charge-principal'],
      },
    ]);
  });

  it('does not merge same-reference same-day income transfers from different clients', () => {
    const charges = [
      buildCharge('charge-client-a', { created_at: new Date('2026-08-15T00:00:00.000Z') }),
      buildCharge('charge-client-b', { created_at: new Date('2026-08-16T00:00:00.000Z') }),
    ];
    const candidates = [
      buildCandidate('tx-client-a', 'charge-client-a', 'REF-10', '2026-08-15T10:00:00.000Z', {
        currency: 'USD',
        amount: '1492.50',
        source_description: 'incoming transfer client alpha',
      }),
      buildCandidate('tx-client-b', 'charge-client-b', 'REF-10', '2026-08-16T10:00:00.000Z', {
        currency: 'USD',
        amount: '3292.50',
        source_description: 'incoming transfer client beta',
      }),
    ];

    const result = buildMergeChargesByTransactionReferencePlan({
      candidates,
      chargeById: buildChargeById(charges),
    });

    expect(result.errors).toEqual([]);
    expect(result.plans).toEqual([]);
  });

  it('does not merge three monthly same-reference payments from the same client', () => {
    const charges = [
      buildCharge('charge-month-1', { created_at: new Date('2026-01-06T00:00:00.000Z') }),
      buildCharge('charge-month-2', { created_at: new Date('2026-02-04T00:00:00.000Z') }),
      buildCharge('charge-month-3', { created_at: new Date('2026-03-04T00:00:00.000Z') }),
    ];
    const candidates = [
      buildCandidate('tx-month-1', 'charge-month-1', 'REF-11', '2026-01-06T10:00:00.000Z', {
        currency: 'ILS',
        amount: '8985.50',
        source_description: 'rtgs incoming payment customer omega',
        counter_account: '912-799-705101',
      }),
      buildCandidate('tx-month-2', 'charge-month-2', 'REF-11', '2026-02-04T10:00:00.000Z', {
        currency: 'ILS',
        amount: '8795.75',
        source_description: 'rtgs incoming payment customer omega',
        counter_account: '912-799-705101',
      }),
      buildCandidate('tx-month-3', 'charge-month-3', 'REF-11', '2026-03-04T10:00:00.000Z', {
        currency: 'ILS',
        amount: '8859.00',
        source_description: 'rtgs incoming payment customer omega',
        counter_account: '912-799-705101',
      }),
    ];

    const result = buildMergeChargesByTransactionReferencePlan({
      candidates,
      chargeById: buildChargeById(charges),
    });

    expect(result.errors).toEqual([]);
    expect(result.plans).toEqual([]);
  });

  it('does not merge repeated same-reference payments in shorter cadence', () => {
    const charges = [
      buildCharge('charge-repeat-1', { created_at: new Date('2026-10-02T00:00:00.000Z') }),
      buildCharge('charge-repeat-2', { created_at: new Date('2026-10-28T00:00:00.000Z') }),
      buildCharge('charge-repeat-3', { created_at: new Date('2026-11-12T00:00:00.000Z') }),
    ];
    const candidates = [
      buildCandidate('tx-repeat-1', 'charge-repeat-1', 'REF-12', '2026-10-02T10:00:00.000Z', {
        currency: 'ILS',
        amount: '9147.75',
        source_description: 'rtgs incoming payment customer omega',
        counter_account: '912-799-705101',
      }),
      buildCandidate('tx-repeat-2', 'charge-repeat-2', 'REF-12', '2026-10-28T10:00:00.000Z', {
        currency: 'ILS',
        amount: '9233.50',
        source_description: 'rtgs incoming payment customer omega',
        counter_account: '912-799-705101',
      }),
      buildCandidate('tx-repeat-3', 'charge-repeat-3', 'REF-12', '2026-11-12T10:00:00.000Z', {
        currency: 'ILS',
        amount: '9146.50',
        source_description: 'rtgs incoming payment customer omega',
        counter_account: '912-799-705101',
      }),
    ];

    const result = buildMergeChargesByTransactionReferencePlan({
      candidates,
      chargeById: buildChargeById(charges),
    });

    expect(result.errors).toEqual([]);
    expect(result.plans).toEqual([]);
  });

  it('does not merge repeated client transfer with distinct swift fee references', () => {
    const charges = [
      buildCharge('charge-swift-1', { created_at: new Date('2026-02-17T00:00:00.000Z') }),
      buildCharge('charge-swift-2', { created_at: new Date('2026-02-09T00:00:00.000Z') }),
    ];
    const candidates = [
      buildCandidate('tx-swift-fee-1', 'charge-swift-1', 'SWIFT-REF-1', '2026-02-17T10:00:00.000Z', {
        currency: 'USD',
        amount: '-25.00',
        is_fee: true,
        source_description: 'swift fee vendor invoice 40430',
        counter_account: 'SWIFT',
      }),
      buildCandidate('tx-transfer-1', 'charge-swift-1', 'REF-13', '2026-02-17T10:00:00.000Z', {
        currency: 'USD',
        amount: '2575.00',
        source_description: 'incoming transfer vendor alpha',
      }),
      buildCandidate('tx-transfer-2', 'charge-swift-2', 'REF-13', '2026-02-09T10:00:00.000Z', {
        currency: 'USD',
        amount: '2575.00',
        source_description: 'incoming transfer vendor alpha',
      }),
      buildCandidate('tx-swift-fee-2', 'charge-swift-2', 'SWIFT-REF-2', '2026-02-09T10:00:00.000Z', {
        currency: 'USD',
        amount: '-25.00',
        is_fee: true,
        source_description: 'swift fee vendor invoice 40443',
        counter_account: 'SWIFT',
      }),
    ];

    const result = buildMergeChargesByTransactionReferencePlan({
      candidates,
      chargeById: buildChargeById(charges),
    });

    expect(result.errors).toEqual([]);
    expect(result.plans).toEqual([]);
  });

  it('does not merge repeated conversion charges with the same bank reference', () => {
    const charges = [
      buildCharge('charge-conversion-1', {
        created_at: new Date('2026-07-17T00:00:00.000Z'),
        type: 'CONVERSION',
        user_description: 'USD to EUR conversion',
      }),
      buildCharge('charge-conversion-2', {
        created_at: new Date('2026-06-29T00:00:00.000Z'),
        type: 'CONVERSION',
        user_description: 'USD to EUR conversion',
      }),
    ];
    const candidates = [
      buildCandidate('tx-conversion-1-usd', 'charge-conversion-1', 'CONV-10086', '2026-07-15T10:00:00.000Z', {
        currency: 'USD',
        amount: '-115945.91',
        source_description: 'conversion',
      }),
      buildCandidate('tx-conversion-1-eur', 'charge-conversion-1', 'CONV-10086', '2026-07-15T10:00:00.000Z', {
        currency: 'EUR',
        amount: '99000.00',
        source_description: 'conversion',
      }),
      buildCandidate('tx-conversion-2-eur', 'charge-conversion-2', 'CONV-10086', '2026-06-26T10:00:00.000Z', {
        currency: 'EUR',
        amount: '101000.00',
        source_description: 'conversion',
      }),
      buildCandidate('tx-conversion-2-usd', 'charge-conversion-2', 'CONV-10086', '2026-06-26T10:00:00.000Z', {
        currency: 'USD',
        amount: '-118935.56',
        source_description: 'conversion',
      }),
    ];

    const result = buildMergeChargesByTransactionReferencePlan({
      candidates,
      chargeById: buildChargeById(charges),
    });

    expect(result.errors).toEqual([]);
    expect(result.plans).toEqual([]);
  });

  it('does not merge foreign-securities charges across cycles by shared fee reference', () => {
    const charges = [
      buildCharge('charge-securities-a', {
        created_at: new Date('2026-03-04T00:00:00.000Z'),
        type: 'FOREIGN_SECURITIES',
      }),
      buildCharge('charge-securities-b', {
        created_at: new Date('2026-02-05T00:00:00.000Z'),
        type: 'FOREIGN_SECURITIES',
      }),
    ];
    const candidates = [
      buildCandidate('tx-securities-payment-a', 'charge-securities-a', 'SEC-REF-A', '2026-03-04T10:00:00.000Z', {
        currency: 'USD',
        amount: '2178.66',
        source_description: 'securities settlement payment batch',
      }),
      buildCandidate('tx-securities-fee-a', 'charge-securities-a', 'SEC-FEE-REF', '2026-03-04T10:00:00.000Z', {
        currency: 'ILS',
        amount: '-33.48',
        is_fee: true,
        source_description: 'securities settlement payment fee',
      }),
      buildCandidate('tx-securities-payment-b', 'charge-securities-b', 'SEC-REF-B', '2026-02-05T10:00:00.000Z', {
        currency: 'USD',
        amount: '2640.09',
        source_description: 'securities settlement payment batch',
      }),
      buildCandidate('tx-securities-fee-b', 'charge-securities-b', 'SEC-FEE-REF', '2026-02-05T10:00:00.000Z', {
        currency: 'ILS',
        amount: '-40.74',
        is_fee: true,
        source_description: 'securities settlement payment fee',
      }),
    ];

    const result = buildMergeChargesByTransactionReferencePlan({
      candidates,
      chargeById: buildChargeById(charges),
    });

    expect(result.errors).toEqual([]);
    expect(result.plans).toEqual([]);
  });

  it('merges foreign-securities fee charge when main description contains padded fee reference', () => {
    const charges = [
      buildCharge('charge-securities-main', {
        created_at: new Date('2026-07-08T00:00:00.000Z'),
        type: 'FOREIGN_SECURITIES',
      }),
      buildCharge('charge-securities-fee', {
        created_at: new Date('2026-07-08T00:00:01.000Z'),
        type: 'FOREIGN_SECURITIES',
      }),
    ];
    const candidates = [
      buildCandidate('tx-securities-fee', 'charge-securities-fee', '79915674', '2026-07-07T10:00:00.000Z', {
        currency: 'ILS',
        amount: '-88.80',
        is_fee: true,
        source_description: 'fsec payment fee',
      }),
      buildCandidate('tx-securities-main', 'charge-securities-main', '3901767', '2026-07-07T10:00:00.000Z', {
        currency: 'USD',
        amount: '4521.61',
        source_description: 'securities settlement 0079915674',
      }),
    ];

    const result = buildMergeChargesByTransactionReferencePlan({
      candidates,
      chargeById: buildChargeById(charges),
    });

    expect(result.errors).toEqual([]);
    expect(result.plans).toEqual([
      {
        reference: '79915674',
        baseChargeId: 'charge-securities-main',
        chargeIdsToMerge: ['charge-securities-fee'],
      },
    ]);
  });

  it('merges foreign-securities fee charge when main description contains padded fee reference and charges types are not defined', () => {
    const charges = [
      buildCharge('charge-securities-main', {
        created_at: new Date('2026-07-08T00:00:00.000Z'),
      }),
      buildCharge('charge-securities-fee', {
        created_at: new Date('2026-07-08T00:00:01.000Z'),
      }),
    ];
    const candidates = [
      buildCandidate('tx-securities-fee', 'charge-securities-fee', '79915674', '2026-07-07T10:00:00.000Z', {
        currency: 'ILS',
        amount: '-88.80',
        is_fee: true,
        source_description: 'ני"עז עמ קניה FSEC BUY FEE',
      }),
      buildCandidate('tx-securities-main', 'charge-securities-main', '3901767', '2026-07-07T10:00:00.000Z', {
        currency: 'USD',
        amount: '4521.61',
        source_description: 'ניע"ז תשלומים 0079915674',
      }),
    ];

    const result = buildMergeChargesByTransactionReferencePlan({
      candidates,
      chargeById: buildChargeById(charges),
    });

    expect(result.errors).toEqual([]);
    expect(result.plans).toEqual([
      {
        reference: '79915674',
        baseChargeId: 'charge-securities-main',
        chargeIdsToMerge: ['charge-securities-fee'],
      },
    ]);
  });

  it('keeps conversion pair separate and merges transfer with related fees', () => {
    const charges = [
      buildCharge('charge-conversion', {
        created_at: new Date('2026-03-02T00:00:00.000Z'),
        type: 'CONVERSION',
      }),
      buildCharge('charge-transfer', {
        created_at: new Date('2026-03-02T00:00:01.000Z'),
        type: null,
      }),
      buildCharge('charge-fee-a', {
        created_at: new Date('2026-03-02T00:00:02.000Z'),
        type: null,
      }),
      buildCharge('charge-fee-b', {
        created_at: new Date('2026-03-05T00:00:02.000Z'),
        type: null,
      }),
    ];
    const candidates = [
      buildCandidate('tx-conversion-base', 'charge-conversion', 'REF-9', '2026-03-02T10:00:00.000Z', {
        currency: 'EUR',
        amount: '1000.00',
        source_description: 'conversion batch 26',
      }),
      buildCandidate('tx-conversion-quote', 'charge-conversion', 'REF-9', '2026-03-02T10:00:00.000Z', {
        currency: 'USD',
        amount: '-1180.00',
        source_description: 'conversion batch 26',
      }),
      buildCandidate('tx-transfer', 'charge-transfer', 'REF-9', '2026-03-02T10:00:00.000Z', {
        currency: 'EUR',
        amount: '-1000.00',
        source_description: 'fx transfer batch 26',
      }),
      buildCandidate('tx-fee-a', 'charge-fee-a', 'REF-9', '2026-03-02T10:00:00.000Z', {
        currency: 'ILS',
        amount: '-2.00',
        is_fee: true,
        source_description: 'fx transfer commission batch 26',
      }),
      buildCandidate('tx-fee-b', 'charge-fee-b', 'REF-9', '2026-03-05T10:00:00.000Z', {
        currency: 'EUR',
        amount: '-10.00',
        is_fee: true,
        source_description: 'bank fee for transfer batch 26',
      }),
    ];

    const result = buildMergeChargesByTransactionReferencePlan({
      candidates,
      chargeById: buildChargeById(charges),
    });

    expect(result.errors).toEqual([]);
    expect(result.plans).toEqual([
      {
        reference: 'REF-9',
        baseChargeId: 'charge-transfer',
        chargeIdsToMerge: ['charge-fee-a', 'charge-fee-b'],
      },
    ]);
  });
});
