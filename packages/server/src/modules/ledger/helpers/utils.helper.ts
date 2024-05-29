import { Injector } from 'graphql-modules';
import { IGetChargesByIdsResult } from '@modules/charges/types.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { IGetFinancialEntitiesByIdsResult } from '@modules/financial-entities/types';
import type { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types';
import { DEFAULT_LOCAL_CURRENCY, EMPTY_UUID } from '@shared/constants';
import { Currency } from '@shared/enums';
import type { FinancialAmount } from '@shared/gql-types';
import { formatCurrency, formatFinancialAmount } from '@shared/helpers';
import type { LedgerBalanceInfoType, LedgerProto, StrictLedgerProto } from '@shared/types';
import type { IGetLedgerRecordsByChargesIdsResult } from '../types.js';

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function isTransactionsOppositeSign([first, second]: IGetTransactionsByChargeIdsResult[]) {
  if (!first || !second) {
    throw new LedgerError('Transactions are missing');
  }
  const firstAmount = Number(first.amount);
  const secondAmount = Number(second.amount);
  if (Number.isNaN(firstAmount) || Number.isNaN(secondAmount)) {
    throw new LedgerError('Transaction amount is not a number');
  }
  return Number(first.amount) > 0 !== Number(second.amount) > 0;
}

export function validateTransactionBasicVariables(transaction: IGetTransactionsByChargeIdsResult) {
  const currency = formatCurrency(transaction.currency);
  if (!transaction.debit_date) {
    throw new LedgerError(
      `Transaction reference "${transaction.source_reference}" is missing debit date for currency ${currency}`,
    );
  }
  const valueDate = transaction.debit_timestamp ?? transaction.debit_date;

  if (!transaction.business_id) {
    throw new LedgerError(
      `Transaction reference "${transaction.source_reference}" is missing business_id`,
    );
  }

  const transactionBusinessId = transaction.business_id;

  return {
    currency,
    valueDate,
    transactionBusinessId,
  };
}

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: NonNullable<T[P]> };
export type ValidateTransaction = Omit<
  WithRequired<IGetTransactionsByChargeIdsResult, 'debit_date' | 'business_id' | 'debit_timestamp'>,
  'currency'
> & { currency: Currency };

type ValidationOptions = {
  skipBusinessId?: boolean;
};

export function validateTransactionRequiredVariables(
  transaction: IGetTransactionsByChargeIdsResult,
  valiadtionOptions: ValidationOptions = {},
): ValidateTransaction {
  if (!transaction.debit_date) {
    throw new LedgerError(
      `Transaction reference "${transaction.source_reference}" is missing debit date for currency ${transaction.currency}`,
    );
  }

  if (!transaction.business_id && !valiadtionOptions.skipBusinessId) {
    throw new LedgerError(
      `Transaction reference "${transaction.source_reference}" is missing business_id`,
    );
  }

  const debit_timestamp = transaction.debit_timestamp ?? transaction.debit_date;

  return {
    ...transaction,
    debit_timestamp,
    currency: formatCurrency(transaction.currency),
  } as ValidateTransaction;
}

export function generatePartialLedgerEntry(
  transaction: ValidateTransaction,
  ownerId: string,
  exchangeRate?: number,
): Omit<StrictLedgerProto, 'creditAccountID1' | 'debitAccountID1'> {
  // set amounts
  let amount = Number(transaction.amount);
  let foreignAmount: number | undefined = undefined;
  if (exchangeRate) {
    foreignAmount = amount;
    // calculate amounts in ILS
    amount = exchangeRate * amount;
  }
  const absAmount = Math.abs(amount);
  const absForeignAmount = foreignAmount ? Math.abs(foreignAmount) : undefined;

  const isCreditorCounterparty = amount > 0;
  return {
    id: transaction.id,
    invoiceDate: transaction.event_date,
    valueDate: transaction.debit_timestamp,
    currency: transaction.currency,
    creditAmount1: absForeignAmount,
    localCurrencyCreditAmount1: absAmount,
    debitAmount1: absForeignAmount,
    localCurrencyDebitAmount1: absAmount,
    description: transaction.source_description ?? undefined,
    reference1: transaction.source_reference ?? undefined,
    isCreditorCounterparty,
    ownerId,
    currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
    chargeId: transaction.charge_id,
  };
}

function entrySingleAccountBalancer(
  ledgerBalance: Map<
    string,
    {
      amount: number;
      entityId: string;
      foreignAmounts?: Partial<Record<Currency, { local: number; foreign: number }>>;
    }
  >,
  entry: LedgerProto,
  isCredit: boolean,
  ledgerEntityNumber: 1 | 2,
) {
  const entityId = isCredit
    ? ledgerEntityNumber === 1
      ? entry.creditAccountID1
      : entry.creditAccountID2
    : ledgerEntityNumber === 1
      ? entry.debitAccountID1
      : entry.debitAccountID2;

  if (!entityId) {
    return;
  }

  const current = ledgerBalance.get(entityId);

  const factor = isCredit ? 1 : -1;
  const currency = entry.currency;
  const amount =
    ((isCredit
      ? ledgerEntityNumber === 1
        ? entry.creditAmount1
        : entry.creditAmount2
      : ledgerEntityNumber === 1
        ? entry.debitAmount1
        : entry.debitAmount2) ?? 0) * factor;
  const localAmount =
    ((isCredit
      ? ledgerEntityNumber === 1
        ? entry.localCurrencyCreditAmount1
        : entry.localCurrencyCreditAmount2
      : ledgerEntityNumber === 1
        ? entry.localCurrencyDebitAmount1
        : entry.localCurrencyDebitAmount2) ?? 0) * factor;
  if (current) {
    current.amount += localAmount;
    current.foreignAmounts ||= {};
    if (amount && currency !== DEFAULT_LOCAL_CURRENCY) {
      current.foreignAmounts[currency] = {
        foreign: (current.foreignAmounts[currency]?.foreign ?? 0) + amount,
        local: (current.foreignAmounts[currency]?.local ?? 0) + localAmount,
      };
    }
  } else {
    ledgerBalance.set(entityId, {
      amount: localAmount,
      entityId,
      foreignAmounts:
        amount && currency !== DEFAULT_LOCAL_CURRENCY
          ? {
              [currency]: {
                foreign: amount,
                local: localAmount,
              },
            }
          : {},
    });
  }
}

export function updateLedgerBalanceByEntry(
  entry: LedgerProto,
  ledgerBalance: Map<
    string,
    {
      amount: number;
      entityId: string;
      foreignAmounts?: Partial<Record<Currency, { local: number; foreign: number }>>;
    }
  >,
): void {
  entrySingleAccountBalancer(ledgerBalance, entry, true, 1);
  entrySingleAccountBalancer(ledgerBalance, entry, true, 2);
  entrySingleAccountBalancer(ledgerBalance, entry, false, 1);
  entrySingleAccountBalancer(ledgerBalance, entry, false, 2);

  return;
}

export async function getLedgerBalanceInfo(
  injector: Injector,
  ledgerBalance: Map<string, { amount: number; entityId: string }>,
  errors: Set<string>,
  allowedUnbalancedBusinesses: Set<string> = new Set(),
  financialEntities?: Array<IGetFinancialEntitiesByIdsResult>,
): Promise<
  LedgerBalanceInfoType & {
    financialEntities: Array<IGetFinancialEntitiesByIdsResult>;
  }
> {
  let ledgerBalanceSum = 0;
  let isBalanced = true;
  const unbalancedEntities: Array<{ entityId: string; balance: FinancialAmount }> = [];

  if (!financialEntities) {
    const financialEntityIDs = new Set<string>(
      Array.from(ledgerBalance.values()).map(v => v.entityId),
    );
    financialEntities = (await injector
      .get(FinancialEntitiesProvider)
      .getFinancialEntityByIdLoader.loadMany(Array.from(financialEntityIDs))
      .then(res =>
        res.filter(fe => !!fe && 'id' in fe),
      )) as Array<IGetFinancialEntitiesByIdsResult>;
  }

  for (const { amount, entityId } of ledgerBalance.values()) {
    if (Math.abs(amount) < 0.005) {
      continue;
    }
    const isBusiness =
      financialEntities?.some(
        financialEntity => financialEntity.id === entityId && financialEntity.type === 'business',
      ) ?? true;

    if (isBusiness && !allowedUnbalancedBusinesses.has(entityId)) {
      let businessIdentification = `ID="${entityId}"`;
      if (financialEntities) {
        const businessName = financialEntities.find(fe => fe.id === entityId)?.name;
        if (businessName) {
          businessIdentification = `"${businessName}"`;
        }
      }
      errors.add(`Business ${businessIdentification} is unbalanced (By ${amount})`);
      isBalanced = false;
    }
    unbalancedEntities.push({
      entityId,
      balance: formatFinancialAmount(amount, DEFAULT_LOCAL_CURRENCY),
    });
    ledgerBalanceSum += amount;
  }
  if (Math.abs(ledgerBalanceSum) >= 0.005) {
    errors.add(`Total ledger balance is ${ledgerBalanceSum}`);
    isBalanced = false;
  }

  return {
    isBalanced,
    unbalancedEntities,
    balanceSum: ledgerBalanceSum,
    financialEntities,
  };
}

export function ledgerProtoToRecordsConverter(
  records: LedgerProto[],
): IGetLedgerRecordsByChargesIdsResult[] {
  return records.map(record => {
    const adjustedRecord: IGetLedgerRecordsByChargesIdsResult = {
      charge_id: record.chargeId,
      created_at: new Date(),
      credit_entity1: record.creditAccountID1 ?? null,
      credit_entity2: record.creditAccountID2 ?? null,
      credit_foreign_amount1: record.creditAmount1?.toString() ?? null,
      credit_foreign_amount2: record.creditAmount2?.toString() ?? null,
      credit_local_amount1: record.localCurrencyCreditAmount1?.toString(),
      credit_local_amount2: record.localCurrencyCreditAmount2?.toString() ?? null,
      currency: record.currency,
      debit_entity1: record.debitAccountID1 ?? null,
      debit_entity2: record.debitAccountID2 ?? null,
      debit_foreign_amount1: record.debitAmount1?.toString() ?? null,
      debit_foreign_amount2: record.debitAmount2?.toString() ?? null,
      debit_local_amount1: record.localCurrencyDebitAmount1?.toString(),
      debit_local_amount2: record.localCurrencyDebitAmount2?.toString() ?? null,
      description: record.description ?? null,
      id: EMPTY_UUID,
      invoice_date: record.invoiceDate,
      owner_id: record.ownerId ?? null,
      reference1: record.reference1 ?? null,
      updated_at: new Date(),
      value_date: record.valueDate,
    };
    return adjustedRecord;
  });
}

export async function getFinancialAccountTaxCategoryId(
  injector: Injector,
  transaction: IGetTransactionsByChargeIdsResult,
): Promise<string> {
  const taxCategory = await injector
    .get(TaxCategoriesProvider)
    .taxCategoryByFinancialAccountIdsAndCurrenciesLoader.load({
      financialAccountId: transaction.account_id,
      currency: transaction.currency as Currency,
    });

  if (!taxCategory) {
    throw new LedgerError(
      `Account id "${transaction.account_id}", with currency ${transaction.currency} is missing tax category`,
    );
  }

  return taxCategory.id;
}

export function multipleForeignCurrenciesBalanceEntries(
  documentEntries: LedgerProto[],
  transactionEntries: LedgerProto[],
  charge: IGetChargesByIdsResult,
  foreignAmounts: Partial<Record<Currency, { local: number; foreign: number }>>,
  balanceAgainstLocal?: boolean,
): LedgerProto[] {
  if (!transactionEntries.length || !documentEntries.length) {
    throw new LedgerError(
      `Failed to locate transaction or document entries for charge "${charge.id}"`,
    );
  }

  const ledgerEntries: LedgerProto[] = [];

  if (charge.business_id && Object.keys(foreignAmounts).length > 0) {
    const mainBusiness = charge.business_id;

    // get the main foreign currency + diff in local currency
    let mainForeignCurrency: { amount: number; currency: Currency } | undefined = undefined;
    let localDiff = 0;
    for (const [currency, { local }] of Object.entries(foreignAmounts)) {
      if (mainForeignCurrency) {
        if (mainForeignCurrency.amount < local) {
          mainForeignCurrency = { amount: local, currency: currency as Currency };
        }
      } else {
        mainForeignCurrency = { amount: local, currency: currency as Currency };
      }
      localDiff += local;
    }

    if (balanceAgainstLocal && !foreignAmounts.ILS) {
      foreignAmounts.ILS = {
        local: -localDiff,
        foreign: 0,
      };
    }

    const transactionEntry = transactionEntries.reduce((prev, curr) => {
      if (!prev) {
        return curr;
      }
      return prev.valueDate.getTime() > curr.valueDate.getTime() ? prev : curr;
    });
    const documentEntry = documentEntries.reduce((prev, curr) => {
      if (!prev) {
        return curr;
      }
      return prev.invoiceDate.getTime() < curr.invoiceDate.getTime() ? prev : curr;
    });

    for (const [currency, { local, foreign }] of Object.entries(foreignAmounts)) {
      let localToUse = local;

      if (!balanceAgainstLocal) {
        if (Math.abs(foreign) < 0.005) {
          continue;
        }

        if (mainForeignCurrency?.currency === currency) {
          localToUse -= localDiff;
        }
      }

      const isLocalCurrencyAndShouldBeBalanced =
        balanceAgainstLocal && mainForeignCurrency && DEFAULT_LOCAL_CURRENCY === currency;
      const isCreditorCounterparty = isLocalCurrencyAndShouldBeBalanced
        ? mainForeignCurrency!.amount > 0
        : foreign < 0;
      const ledgerEntry: LedgerProto = {
        id: transactionEntry.id + `|${currency}-balance`, // NOTE: this field is dummy
        ...(isCreditorCounterparty
          ? {
              creditAccountID1: mainBusiness,
            }
          : {
              debitAccountID1: mainBusiness,
            }),
        localCurrencyCreditAmount1: Math.abs(localToUse),
        localCurrencyDebitAmount1: Math.abs(localToUse),
        ...(balanceAgainstLocal && !foreign
          ? {}
          : {
              creditAmount1: Math.abs(foreign),
              debitAmount1: Math.abs(foreign),
            }),
        description: 'Foreign currency balance',
        isCreditorCounterparty,
        invoiceDate: documentEntry.invoiceDate,
        valueDate: transactionEntry.valueDate,
        currency: currency as Currency,
        ownerId: transactionEntry.ownerId,
        chargeId: charge.id,
      };
      ledgerEntries.push(ledgerEntry);
    }
  }

  return ledgerEntries;
}
