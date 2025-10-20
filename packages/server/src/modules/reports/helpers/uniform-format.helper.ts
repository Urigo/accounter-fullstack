import { subDays } from 'date-fns';
import { GraphQLResolveInfo } from 'graphql';
import type {
  Account,
  BusinessMetadata,
  CurrencyCode,
  JournalEntry,
} from '@accounter/shaam-uniform-format-generator';
import { isCryptoCurrency } from '@modules/exchange-rates/helpers/exchange.helper.js';
import { AdminBusinessesProvider } from '@modules/financial-entities/providers/admin-businesses.provider.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { businessTransactionsSumFromLedgerRecords } from '@modules/financial-entities/resolvers/business-transactions-sum-from-ledger-records.resolver.js';
import { IGetBusinessesByIdsResult } from '@modules/financial-entities/types';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { SortCodesProvider } from '@modules/sort-codes/providers/sort-codes.provider.js';
import { Currency } from '@shared/enums';
import { dateToTimelessDateString } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';

export async function businessForUniformFormat(
  context: GraphQLModules.ModuleContext,
  fromDate: TimelessDateString,
  toDate: TimelessDateString,
): Promise<BusinessMetadata> {
  const {
    adminContext: { defaultAdminBusinessId: ownerId },
    injector,
  } = context;

  const adminBusiness = await injector
    .get(AdminBusinessesProvider)
    .getAdminBusinessByIdLoader.load(ownerId);

  if (!adminBusiness) {
    throw new Error('Admin business not found');
  }

  if (!adminBusiness.vat_number) {
    throw new Error('Admin business has no VAT number');
  }

  return {
    businessId: adminBusiness.id,
    name: adminBusiness.name,
    taxId: adminBusiness.vat_number,
    reportingPeriod: {
      startDate: fromDate,
      endDate: toDate,
    },
  };
}

export async function journalEntriesForUniformFormat(
  context: GraphQLModules.ModuleContext,
  fromDate: TimelessDateString,
  toDate: TimelessDateString,
): Promise<JournalEntry[]> {
  const {
    adminContext: { defaultAdminBusinessId: ownerId },
    injector,
  } = context;

  const ledgerRecords = await injector
    .get(LedgerProvider)
    .getLedgerRecordsByDates({ ownerId, fromDate, toDate });

  const entries: JournalEntry[] = [];

  for (const record of ledgerRecords) {
    const isCrypto = isCryptoCurrency(record.currency.toUpperCase() as Currency);
    const commonEntry: Omit<
      JournalEntry,
      | 'accountId'
      | 'amount'
      | 'counterAccountKey'
      | 'debitCreditIndicator'
      | 'foreignCurrencyAmount'
      | 'transactionLineNumber'
    > = {
      id: record.id,
      date: dateToTimelessDateString(record.invoice_date),
      description: record.description ?? '',
      transactionNumber: Number(record.id.replace(/\D/g, '').slice(-10)),
      batchNumber: 1,
      // "transactionType": '',
      referenceDocument: record.reference1 ?? undefined,
      // "referenceDocumentType": '',
      referenceDocument2: undefined,
      // "referenceDocumentType2": '',
      valueDate: dateToTimelessDateString(record.value_date),
      currencyCode: isCrypto ? 'ILS' : (record.currency as unknown as CurrencyCode),
      transactionAmount: Math.max(
        Math.abs(Number(record.credit_local_amount1)),
        Math.abs(Number(record.debit_local_amount1)),
      ),
      // "quantityField": '',
      matchingField1: record.charge_id,
      matchingField2: undefined,
      // "branchId": '',
      entryDate: dateToTimelessDateString(record.created_at),
      // "operatorUsername": '',
    };

    let lineNumber = 1;

    // for credit1
    if (record.credit_entity1 && Math.abs(Number(record.credit_local_amount1)) > 0) {
      entries.push({
        ...commonEntry,
        id: `c1-${commonEntry.id}`,
        accountId: record.credit_entity1,
        amount: Math.abs(Number(record.credit_local_amount1)),
        counterAccountKey: record.debit_entity1 ?? undefined,
        debitCreditIndicator: '2', // 2 for credit
        foreignCurrencyAmount:
          record.credit_foreign_amount1 && !isCrypto
            ? Math.abs(Number(record.credit_foreign_amount1))
            : undefined,
        transactionLineNumber: lineNumber,
      });

      lineNumber++;
    }

    // for credit2
    if (record.credit_entity2 && Math.abs(Number(record.credit_local_amount1)) > 0) {
      entries.push({
        ...commonEntry,
        id: `c2-${commonEntry.id}`,
        accountId: record.credit_entity2,
        amount: Math.abs(Number(record.credit_local_amount2)),
        counterAccountKey: record.debit_entity1 ?? undefined,
        debitCreditIndicator: '2', // 2 for credit
        foreignCurrencyAmount:
          record.credit_foreign_amount2 && !isCrypto
            ? Math.abs(Number(record.credit_foreign_amount2))
            : undefined,
        transactionLineNumber: lineNumber,
      });

      lineNumber++;
    }

    // for debit1
    if (record.debit_entity1 && Math.abs(Number(record.debit_local_amount1)) > 0) {
      entries.push({
        ...commonEntry,
        id: `d1-${commonEntry.id}`,
        accountId: record.debit_entity1,
        amount: Math.abs(Number(record.debit_local_amount1)),
        counterAccountKey: record.credit_entity1 ?? undefined,
        debitCreditIndicator: '1', // 1 for debit
        foreignCurrencyAmount:
          record.debit_foreign_amount1 && !isCrypto
            ? Math.abs(Number(record.debit_foreign_amount1))
            : undefined,
        transactionLineNumber: lineNumber,
      });

      lineNumber++;
    }

    // for debit2
    if (record.debit_entity2 && Math.abs(Number(record.debit_local_amount2)) > 0) {
      entries.push({
        ...commonEntry,
        id: `d2-${commonEntry.id}`,
        accountId: record.debit_entity2,
        amount: Math.abs(Number(record.debit_local_amount2)),
        counterAccountKey: record.credit_entity1 ?? undefined,
        debitCreditIndicator: '1', // 1 for debit
        foreignCurrencyAmount:
          record.debit_foreign_amount2 && !isCrypto
            ? Math.abs(Number(record.debit_foreign_amount2))
            : undefined,
        transactionLineNumber: lineNumber,
      });
    }
  }

  return entries;
}

export async function accountsForUniformFormat(
  context: GraphQLModules.ModuleContext,
  info: GraphQLResolveInfo,
  fromDate: TimelessDateString,
  toDate: TimelessDateString,
): Promise<Account[]> {
  const {
    adminContext: { defaultAdminBusinessId: ownerId },
    injector,
  } = context;

  const financialEntitiesPromise = injector
    .get(FinancialEntitiesProvider)
    .getAllFinancialEntities();

  // get admin business info
  const adminBusinessPromise = injector
    .get(AdminBusinessesProvider)
    .getAdminBusinessByIdLoader.load(ownerId);

  const [financialEntities, adminBusiness, sortCodes] = await Promise.all([
    financialEntitiesPromise,
    adminBusinessPromise,
    injector.get(SortCodesProvider).getAllSortCodes(),
  ]);

  if (!adminBusiness) {
    throw new Error('Admin business not found');
  }

  const openingBalances = await businessTransactionsSumFromLedgerRecords(
    {},
    {
      filters: {
        ownerIds: [ownerId],
        toDate: dateToTimelessDateString(subDays(new Date(fromDate), 1)),
        includeRevaluation: true,
      },
    },
    context,
    info,
  );

  const businessesBalance = new Map<
    string,
    {
      ILS: {
        opening: number;
        credit: number;
        debit: number;
      };
      foreign?: {
        currency: string;
        total: number;
      };
    }
  >();
  if (openingBalances.__typename === 'CommonError') {
    throw new Error(`Failed to fetch opening balances: ${openingBalances.message}`);
  } else if (
    openingBalances.__typename === 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult'
  ) {
    await Promise.all(
      openingBalances.businessTransactionsSum.map(async businessSumPromise => {
        const businessSum = await businessSumPromise;
        for (const [code, amounts] of Object.entries(businessSum)) {
          if (
            isCryptoCurrency(code.toUpperCase() as Currency) ||
            code === 'ILS' ||
            code === 'businessId'
          ) {
            continue;
          }
          if (typeof amounts !== 'string' && amounts.total !== 0) {
            businessesBalance.set(businessSum.businessId, {
              ILS: {
                opening: businessSum.ILS.total,
                credit: 0,
                debit: 0,
              },
              foreign: { currency: code, total: amounts.total },
            });
            return;
          }
        }

        if (businessSum.ILS.total !== 0) {
          businessesBalance.set(businessSum.businessId, {
            ILS: {
              opening: businessSum.ILS.total,
              credit: 0,
              debit: 0,
            },
          });
        }
      }),
    );
  }

  const totalDebitCredit = await businessTransactionsSumFromLedgerRecords(
    {},
    {
      filters: {
        ownerIds: [ownerId],
        fromDate,
        toDate,
        includeRevaluation: true,
      },
    },
    context,
    info,
  );

  if (totalDebitCredit.__typename === 'CommonError') {
    throw new Error(`Failed to fetch opening balances: ${totalDebitCredit.message}`);
  } else if (
    totalDebitCredit.__typename === 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult'
  ) {
    await Promise.all(
      totalDebitCredit.businessTransactionsSum.map(async businessSumPromise => {
        const businessSum = await businessSumPromise;
        const existing = businessesBalance.get(businessSum.businessId);
        if (existing) {
          existing.ILS.credit += businessSum.ILS.credit;
          existing.ILS.debit += businessSum.ILS.debit;
        } else {
          businessesBalance.set(businessSum.businessId, {
            ILS: {
              opening: 0,
              credit: businessSum.ILS.credit,
              debit: businessSum.ILS.debit,
            },
          });
        }
      }),
    );
  }

  const businesses = await injector
    .get(BusinessesProvider)
    .getBusinessByIdLoader.loadMany(Array.from(businessesBalance.keys()));
  const businessesMap = new Map(
    (businesses.filter(b => b && !(b instanceof Error)) as IGetBusinessesByIdsResult[]).map(
      business => [business.id, business],
    ),
  );

  const sortCodesMap = new Map(sortCodes.map(code => [code.key, code.name ?? '']));

  const financialEntitiesMap = new Map(financialEntities.map(entity => [entity.id, entity]));

  const accounts: Account[] = [];
  for (const [businessId, balance] of Array.from(businessesBalance.entries())) {
    const financialEntity = financialEntitiesMap.get(businessId);
    if (!financialEntity) {
      throw new Error(`Financial entity not found for business ID: ${businessId}`);
    }
    if (!financialEntity.sort_code) {
      throw new Error(`Financial entity ${financialEntity.id} has no sort code`);
    }
    const sortCodeName = financialEntity.sort_code
      ? sortCodesMap.get(financialEntity.sort_code)
      : undefined;
    if (!sortCodeName) {
      throw new Error(`Sort code not found for business ID: ${businessId}`);
    }

    accounts.push({
      id: businessId,
      name: financialEntity.name,
      sortCode: {
        key: financialEntity.sort_code.toString(),
        name: sortCodeName,
      },
      address: {
        // street: businessesMap.get(businessId)?.address?.street,
        // houseNumber: businessesMap.get(businessId)?.address?.houseNumber,
        // city: businessesMap.get(businessId)?.address?.city,
        // zip: businessesMap.get(businessId)?.address?.zip,
        country: businessesMap.get(businessId)?.country === 'ISR' ? 'IL' : undefined,
      },
      // countryCode: businessesMap.get(businessId)?.countryCode,
      // parentAccountKey: businessesMap.get(businessId)?.parentAccountKey,
      vatId: businessesMap.get(businessId)?.vat_number ?? undefined,
      accountOpeningBalance: balance.ILS.opening,
      totalDebits: balance.ILS.debit || undefined,
      totalCredits: balance.ILS.credit || undefined,
      // accountingClassificationCode:
      //   businessesMap.get(businessId)?.accountingClassificationCode ?? '',
      // branchId: businessesMap.get(businessId)?.branchId ?? '',
      openingBalanceForeignCurrency: balance.foreign?.total, // TODO: handle foreign currency
      foreignCurrencyCode: balance.foreign?.currency,
    });
  }

  return accounts;
}
