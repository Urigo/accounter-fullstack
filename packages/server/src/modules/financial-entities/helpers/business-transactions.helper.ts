import type { IGetChargesByIdsResult } from '@modules/charges/types';
import { IGetLedgerRecordsByChargesIdsResult } from '@modules/ledger/types';
import { Currency } from '@shared/enums';
import { CommonError, ResolverTypeWrapper } from '@shared/gql-types';
import type {
  BusinessTransactionProto,
  CounterAccountProto,
  LedgerRecordsProto,
  RawBusinessTransactionsSum,
} from '@shared/types';

export async function getLedgerRecordsFromSets(
  ledgerRecordSets: Array<CommonError | LedgerRecordsProto | null>,
  charges: IGetChargesByIdsResult[],
): Promise<Array<IGetLedgerRecordsByChargesIdsResult>> {
  const ledgerRecordsPromises: ResolverTypeWrapper<IGetLedgerRecordsByChargesIdsResult>[] = [];
  ledgerRecordSets.map((ledgerRecordSet, i) => {
    if (!ledgerRecordSet) {
      console.log(`No ledger records could be generated for charge ${charges[i]?.id}`);
    } else if (
      ('__typename' in ledgerRecordSet || 'message' in ledgerRecordSet) &&
      ledgerRecordSet.__typename === 'CommonError'
    ) {
      console.log(
        `Error generating ledger records for charge ${charges[i]?.id}: ${ledgerRecordSet.message}`,
      );
    } else {
      ledgerRecordsPromises.push(
        ...(
          ledgerRecordSet as {
            records: readonly ResolverTypeWrapper<IGetLedgerRecordsByChargesIdsResult>[];
          }
        ).records,
      );
    }
  });

  return await Promise.all(ledgerRecordsPromises);
}

export function handleBusinessLedgerRecord(
  rawRes: Record<string, RawBusinessTransactionsSum>,
  business: CounterAccountProto,
  currency: Currency,
  isCredit: boolean,
  stringifiedAmount: string | null,
  stringifiedForeignAmount: string | null,
) {
  const businessID = typeof business === 'string' ? business : business.id;
  const amount = stringifiedAmount ? parseFloat(stringifiedAmount) : 0;
  const foreignAmount = stringifiedForeignAmount ? parseFloat(stringifiedForeignAmount) : 0;

  rawRes[businessID] ??= {
    ils: {
      credit: 0,
      debit: 0,
      total: 0,
    },
    eur: {
      credit: 0,
      debit: 0,
      total: 0,
    },
    gbp: {
      credit: 0,
      debit: 0,
      total: 0,
    },
    usd: {
      credit: 0,
      debit: 0,
      total: 0,
    },
    business,
  };

  const record = rawRes[businessID];
  let currencyField: 'eur' | 'usd' | 'gbp' | 'ils' | undefined = undefined;
  switch (currency) {
    case Currency.Ils: {
      currencyField = 'ils';
      break;
    }
    case Currency.Eur: {
      currencyField = 'eur';
      break;
    }
    case Currency.Gbp: {
      currencyField = 'gbp';
      break;
    }
    case Currency.Usd: {
      currencyField = 'usd';
      break;
    }
    default: {
      console.log(`currency ${currency} not supported`);
      currencyField = 'ils';
    }
  }

  record.ils.credit += isCredit ? amount : 0;
  record.ils.debit += isCredit ? 0 : amount;
  record.ils.total += (isCredit ? 1 : -1) * amount;

  if (currencyField !== 'ils') {
    const foreignInfo = record[currencyField];

    foreignInfo.credit += isCredit ? foreignAmount : 0;
    foreignInfo.debit += isCredit ? 0 : foreignAmount;
    foreignInfo.total += (isCredit ? 1 : -1) * foreignAmount;
  }
}

export function handleBusinessTransaction(
  record: IGetLedgerRecordsByChargesIdsResult,
  businessID: CounterAccountProto,
  counterparty: CounterAccountProto | null = null,
  isCredit: boolean,
  stringifiedAmount: string | null,
  stringifiedForeignAmount: string | null,
): BusinessTransactionProto {
  const amount = stringifiedAmount ? parseFloat(stringifiedAmount) : 0;
  const foreignAmount = stringifiedForeignAmount ? parseFloat(stringifiedForeignAmount) : 0;

  const rawTransaction: BusinessTransactionProto = {
    amount,
    businessID,
    counterAccount: counterparty ?? undefined,
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
