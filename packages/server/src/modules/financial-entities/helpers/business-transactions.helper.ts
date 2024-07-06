import { IGetLedgerRecordsByChargesIdsResult } from '@modules/ledger/types';
import { DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import { Currency } from '@shared/enums';
import type { BusinessTransactionProto, RawBusinessTransactionsSum } from '@shared/types';

export function handleBusinessLedgerRecord(
  rawRes: Record<string, RawBusinessTransactionsSum>,
  businessId: string,
  currency: Currency,
  isCredit: boolean,
  stringifiedAmount: string | null,
  stringifiedForeignAmount: string | null,
) {
  const amount = stringifiedAmount ? parseFloat(stringifiedAmount) : 0;
  const foreignAmount = stringifiedForeignAmount ? parseFloat(stringifiedForeignAmount) : 0;

  rawRes[businessId] ??= {
    ...(Object.fromEntries(
      Object.values(Currency).map(currency => [currency, { credit: 0, debit: 0, total: 0 }]),
    ) as Omit<RawBusinessTransactionsSum, 'businessId'>),
    businessId,
  };

  const record = rawRes[businessId];
  record[DEFAULT_LOCAL_CURRENCY].credit += isCredit ? amount : 0;
  record[DEFAULT_LOCAL_CURRENCY].debit += isCredit ? 0 : amount;
  record[DEFAULT_LOCAL_CURRENCY].total += (isCredit ? 1 : -1) * amount;

  if (currency !== DEFAULT_LOCAL_CURRENCY) {
    const foreignInfo = record[currency];

    foreignInfo.credit += isCredit ? foreignAmount : 0;
    foreignInfo.debit += isCredit ? 0 : foreignAmount;
    foreignInfo.total += (isCredit ? 1 : -1) * foreignAmount;
  }
}

export function handleBusinessTransaction(
  record: IGetLedgerRecordsByChargesIdsResult,
  businessId: string,
  counterpartyId: string | null = null,
  isCredit: boolean,
  stringifiedAmount: string | null,
  stringifiedForeignAmount: string | null,
): BusinessTransactionProto {
  const amount = stringifiedAmount ? parseFloat(stringifiedAmount) : 0;
  const foreignAmount = stringifiedForeignAmount ? parseFloat(stringifiedForeignAmount) : 0;

  const rawTransaction: BusinessTransactionProto = {
    amount,
    businessId,
    counterAccountId: counterpartyId ?? undefined,
    currency: record.currency as Currency,
    details: record.description ?? undefined,
    isCredit,
    ownerID: record.owner_id!,
    foreignAmount,
    date: record.invoice_date,
    reference1: record.reference1 ?? undefined,
    chargeId: record.charge_id,
  };
  return rawTransaction;
}
