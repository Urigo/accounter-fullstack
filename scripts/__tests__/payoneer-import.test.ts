import { describe, expect, it } from 'vitest';
import {
  isFinalPayoneerItem,
  toPayoneerTransactionInput,
  type PayoneerActivityExportItem,
} from '../payoneer-import.js';

const payment: PayoneerActivityExportItem = {
  listDescription: 'Payment from ACME CORP - XX-000001 (TEST CO)',
  details: {
    activityMainData: {
      EntityId: '10000001',
      ActivityItemId: '2000000001',
      ActivityTypeId: 10,
      ActivityItemStatus: 2,
      ActivityDate: '2026-01-15T06:04:27.577',
      Currency: 'USD',
      Amount: 990,
      Fee: -10,
      Balance: 1_500,
      IsFinal: true,
      GLPSAccountNumber: '70500000000000001',
    },
    activityDetails: {
      InitiatorName: 'ACME CORP',
      PaymentDescription: 'RMR*IV*90001**1000\\',
      PseudoAccount: '70500000000000001',
      SourceAmount: 1_000,
    },
  },
};

const withdrawal: PayoneerActivityExportItem = {
  listDescription: 'Withdrawal to Test Bank (0001)',
  details: {
    activityMainData: {
      EntityId: '10000001',
      ActivityItemId: '2000000002',
      ActivityTypeId: 1,
      ActivityItemStatus: 2,
      ActivityDate: '2026-01-20T03:06:40.983',
      Currency: 'USD',
      Amount: -500,
      Fee: -20,
      Balance: 0,
      IsFinal: true,
      UserDescription: 'Invoice 90002',
    },
    activityDetails: {
      DisplayName: 'Test Bank (0001)',
      UserDescription: 'Invoice 90002',
      LoadId: '4366000000000001',
      AccountNumber: 'IL000000000000000000001',
      AmountLoaded: 480,
    },
  },
};

describe('toPayoneerTransactionInput', () => {
  it('maps an incoming payment', () => {
    expect(toPayoneerTransactionInput(payment)).toEqual({
      accountId: '10000001',
      transactionId: '2000000001',
      activityType: 10,
      status: 2,
      activityDate: '2026-01-15T06:04:27.577',
      currency: 'USD',
      amount: 990,
      fee: -10,
      balance: 1_500,
      description: 'Payment from ACME CORP - XX-000001 (TEST CO)',
      counterpartyName: 'ACME CORP',
      paymentDescription: 'RMR*IV*90001**1000\\',
      receivingAccount: '70500000000000001',
      transferId: null,
      targetAccount: null,
      grossAmount: 1_000,
      amountSent: null,
      rawData: JSON.stringify(payment.details),
    });
  });

  it('maps a withdrawal to a bank account', () => {
    expect(toPayoneerTransactionInput(withdrawal)).toMatchObject({
      activityType: 1,
      amount: -500,
      fee: -20,
      counterpartyName: 'Test Bank (0001)',
      paymentDescription: 'Invoice 90002',
      transferId: '4366000000000001',
      targetAccount: 'IL000000000000000000001',
      amountSent: 480,
      receivingAccount: null,
    });
  });

  it('always books the fee as a deduction, and no fee as 0', () => {
    const positiveFee = structuredClone(payment);
    positiveFee.details.activityMainData.Fee = 10;
    expect(toPayoneerTransactionInput(positiveFee).fee).toBe(-10);

    const noFee = structuredClone(payment);
    noFee.details.activityMainData.Fee = null;
    expect(toPayoneerTransactionInput(noFee).fee).toBe(0);
  });
});

describe('isFinalPayoneerItem', () => {
  it('accepts completed items only', () => {
    expect(isFinalPayoneerItem(payment)).toBe(true);
    const pending = structuredClone(payment);
    pending.details.activityMainData.IsFinal = false;
    expect(isFinalPayoneerItem(pending)).toBe(false);
  });
});
