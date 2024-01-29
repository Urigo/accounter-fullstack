import type {
  ResolversTypes,
  ResolversUnionTypes,
  ResolverTypeWrapper,
} from '@accounter-toolkit/green-invoice-graphql';
import type { IGetChargesByIdsResult } from '@modules/charges/types';
import { Currency } from '@shared/enums';
import type {
  BusinessTransactionProto,
  CounterAccountProto,
  LedgerProto,
  RawBusinessTransactionsSum,
} from '@shared/types';

export async function getLedgerRecordsFromSets(
  ledgerRecordSets: Array<ResolversUnionTypes<ResolversTypes>['GeneratedLedgerRecords']>,
  charges: IGetChargesByIdsResult[],
): Promise<Array<LedgerProto>> {
  const ledgerRecordsPromises: ResolverTypeWrapper<LedgerProto>[] = [];
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
        ...(ledgerRecordSet as { records: readonly ResolverTypeWrapper<LedgerProto>[] }).records,
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
  amount = 0,
  foreignAmount = 0,
) {
  const businessID = typeof business === 'string' ? business : business.id;
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
  record: LedgerProto,
  businessID: CounterAccountProto,
  counterparty: CounterAccountProto | undefined = undefined,
  isCredit: boolean,
  amount = 0,
  foreignAmount = 0,
): BusinessTransactionProto {
  const rawTransaction: BusinessTransactionProto = {
    amount,
    businessID,
    counterAccount: counterparty,
    currency: record.currency,
    details: record.description,
    isCredit,
    ownerID: record.ownerId,
    foreignAmount,
    date: record.invoiceDate,
    reference1: record.reference1,
    chargeId: record.chargeId,
  };
  return rawTransaction;
}
