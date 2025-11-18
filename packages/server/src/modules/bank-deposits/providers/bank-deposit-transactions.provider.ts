import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { dateToTimelessDateString } from '@shared/helpers';
import type {
  IAddBankDepositTransactionParams,
  IAddBankDepositTransactionQuery,
  IDeleteBankDepositTransactionsByIdsParams,
  IDeleteBankDepositTransactionsByIdsQuery,
  IGetAllDepositsWithTransactionsQuery,
  IGetBankDepositTransactionsByIdsQuery,
  IGetDepositTransactionsByChargeIdQuery,
  IGetDepositTransactionsByTransactionIdQuery,
  IGetTransactionsByBankDepositsQuery,
  IUpdateBankDepositTransactionParams,
  IUpdateBankDepositTransactionQuery,
} from '../types.js';

const getBankDepositTransactionsByIds = sql<IGetBankDepositTransactionsByIdsQuery>`
    SELECT *
    FROM accounter_schema.transactions_bank_deposits
    WHERE id IN $$transactionIds;`;

const getTransactionsByBankDeposits = sql<IGetTransactionsByBankDepositsQuery>`
    SELECT *
    FROM accounter_schema.transactions_bank_deposits
    LEFT JOIN accounter_schema.transactions
      USING (id)
    WHERE deposit_id IN $$depositIds;`;

const getDepositTransactionsByTransactionId = sql<IGetDepositTransactionsByTransactionIdQuery>`
    SELECT *
    FROM accounter_schema.transactions_bank_deposits
    LEFT JOIN accounter_schema.transactions
      USING (id)
    WHERE deposit_id IN (
      SELECT deposit_id
      FROM accounter_schema.transactions_bank_deposits
      WHERE id = $transactionId
    );`;

const getDepositTransactionsByChargeId = sql<IGetDepositTransactionsByChargeIdQuery>`
    SELECT *
    FROM accounter_schema.transactions_bank_deposits
    LEFT JOIN accounter_schema.transactions
      USING (id)
    WHERE deposit_id IN (
      SELECT deposit_id
      FROM accounter_schema.transactions_bank_deposits
      LEFT JOIN accounter_schema.transactions
        USING (id)
      WHERE charge_id = $chargeId
    )
    AND ($includeCharge OR charge_id <> $chargeId);`;

const updateBankDepositTransaction = sql<IUpdateBankDepositTransactionQuery>`
  UPDATE accounter_schema.transactions_bank_deposits
  SET
    deposit_id = COALESCE(
      $depositId,
      deposit_id,
      NULL
    )
  WHERE
    id = $transactionId
  RETURNING *;
`;

const addBankDepositTransaction = sql<IAddBankDepositTransactionQuery>`
  INSERT INTO accounter_schema.transactions_bank_deposits (id, deposit_id)
  VALUES $$bankDepositTransactions(id, depositId)
  ON CONFLICT DO NOTHING
  RETURNING *;`;

const deleteBankDepositTransactionsByIds = sql<IDeleteBankDepositTransactionsByIdsQuery>`
    DELETE FROM accounter_schema.transactions_bank_deposits
    WHERE id IN $$transactionIds;`;

const getAllDepositsWithTransactions = sql<IGetAllDepositsWithTransactionsQuery>`
    SELECT 
      tbd.deposit_id,
      t.id,
      t.currency,
      t.debit_date,
      t.event_date,
      t.amount,
      t.current_balance,
      t.charge_id
    FROM accounter_schema.transactions_bank_deposits tbd
    LEFT JOIN accounter_schema.transactions t
      USING (id)
    WHERE tbd.deposit_id IS NOT NULL
    ORDER BY tbd.deposit_id, COALESCE(t.debit_date, t.event_date);`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BankDepositTransactionsProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchBankDepositTransactionsByIds(ids: readonly string[]) {
    const transactions = await getBankDepositTransactionsByIds.run(
      {
        transactionIds: ids,
      },
      this.dbProvider,
    );
    return ids.map(id => transactions.find(t => t.id === id));
  }

  public getBankDepositTransactionByIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchBankDepositTransactionsByIds(keys),
    { cache: false },
  );

  private async batchTransactionsByBankDeposits(depositIds: readonly string[]) {
    const transactions = await getTransactionsByBankDeposits.run(
      {
        depositIds,
      },
      this.dbProvider,
    );
    return depositIds.map(id => transactions.filter(t => t.deposit_id === id));
  }

  public getTransactionsByBankDepositLoader = new DataLoader(
    (keys: readonly string[]) => this.batchTransactionsByBankDeposits(keys),
    { cache: false },
  );

  public getDepositTransactionsByTransactionId(transactionId: string) {
    return getDepositTransactionsByTransactionId.run({ transactionId }, this.dbProvider);
  }

  public getDepositTransactionsByChargeId(chargeId: string, includeCharge = false) {
    return getDepositTransactionsByChargeId.run({ chargeId, includeCharge }, this.dbProvider);
  }

  public updateBankDepositTransaction(params: IUpdateBankDepositTransactionParams) {
    return updateBankDepositTransaction.run(params, this.dbProvider);
  }

  public addBankDepositTransaction(params: IAddBankDepositTransactionParams) {
    return addBankDepositTransaction.run(params, this.dbProvider);
  }

  public deleteBankDepositTransactionsByIds(params: IDeleteBankDepositTransactionsByIdsParams) {
    return deleteBankDepositTransactionsByIds.run(params, this.dbProvider);
  }

  public async getAllDepositsWithMetadata() {
    const rows = await getAllDepositsWithTransactions.run(undefined, this.dbProvider);

    // Group transactions by deposit_id
    const depositMap = new Map<
      string,
      {
        id: string;
        currency: string | null;
        openDate: Date | null;
        closeDate: Date | null;
        currentBalance: number;
        totalInterest: number;
        currencyError: string[];
        transactionIds: string[];
      }
    >();

    // First pass: identify interest transactions by grouping by charge_id
    const chargeGroups = new Map<string, typeof rows>();
    for (const row of rows) {
      if (!row.charge_id) continue;
      if (!chargeGroups.has(row.charge_id)) {
        chargeGroups.set(row.charge_id, []);
      }
      chargeGroups.get(row.charge_id)!.push(row);
    }

    const interestTransactionIds = new Set<string>();
    for (const [_, transactions] of chargeGroups) {
      if (transactions.length > 1) {
        // Multiple transactions per charge - find the one with highest absolute amount
        const sortedByAbsAmount = [...transactions].sort(
          (a, b) => Math.abs(Number(b.amount ?? 0)) - Math.abs(Number(a.amount ?? 0)),
        );
        // All except the first (highest) are interest
        for (let i = 1; i < sortedByAbsAmount.length; i++) {
          interestTransactionIds.add(sortedByAbsAmount[i].id);
        }
      }
    }

    for (const row of rows) {
      if (!row.deposit_id) continue;

      if (!depositMap.has(row.deposit_id)) {
        depositMap.set(row.deposit_id, {
          id: row.deposit_id,
          currency: row.currency,
          openDate: row.debit_date ?? row.event_date,
          closeDate: null,
          currentBalance: 0,
          totalInterest: 0,
          currencyError: [],
          transactionIds: [],
        });
      }

      const deposit = depositMap.get(row.deposit_id)!;
      deposit.transactionIds.push(row.id);

      // Validate single currency
      if (deposit.currency && row.currency && deposit.currency !== row.currency) {
        const alreadyInErrors = deposit.currencyError.includes(row.id);
        if (!alreadyInErrors) {
          deposit.currencyError.push(row.id);
        }
      }

      // Update openDate (earliest transaction)
      const txDate = row.debit_date ?? row.event_date;
      if (!deposit.openDate || (txDate && txDate < deposit.openDate)) {
        deposit.openDate = txDate;
      }

      // Track balance and interest separately
      if (row.amount) {
        const amount = Number(row.amount);
        if (interestTransactionIds.has(row.id)) {
          deposit.totalInterest += amount;
        } else {
          deposit.currentBalance += amount;
        }
      }

      // If balance reaches zero, update closeDate (interest doesn't affect closure)
      if (Math.abs(deposit.currentBalance) < 0.005 && txDate) {
        deposit.closeDate = txDate;
      }
    }

    // Ensure closeDate reflects final state: if not closed, closeDate must be null
    for (const d of depositMap.values()) {
      if (Math.abs(d.currentBalance) >= 0.005) {
        d.closeDate = null;
      }
    }

    return Array.from(depositMap.values()).map(deposit => ({
      id: deposit.id,
      currency: deposit.currency,
      openDate: deposit.openDate ? dateToTimelessDateString(deposit.openDate) : null,
      closeDate: deposit.closeDate ? dateToTimelessDateString(deposit.closeDate) : null,
      currentBalance: deposit.currentBalance,
      totalInterest: deposit.totalInterest,
      currencyError: deposit.currencyError,
      transactionIds: deposit.transactionIds,
    }));
  }

  public async createDeposit(currency: string) {
    // Generate unique deposit ID using timestamp and random suffix
    const depositId = `${currency}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    return {
      id: depositId,
      currency,
      openDate: null,
      closeDate: null,
      currentBalance: 0,
      totalInterest: 0,
      currencyError: [],
      transactionIds: [],
    };
  }

  public async assignTransactionToDeposit(transactionId: string, depositId: string) {
    // Get transaction to validate currency
    const transactionDepositInfo = await getBankDepositTransactionsByIds.run(
      { transactionIds: [transactionId] },
      this.dbProvider,
    );

    if (transactionDepositInfo.length === 0) {
      throw new Error('Transaction not found');
    }

    // Get target deposit transactions to validate currency
    const depositTransactions = await this.getTransactionsByBankDepositLoader.load(depositId);

    // Get transaction details to check currency
    const fullTransaction = depositTransactions.find(t => t.id === transactionId);

    // Check currency conflict
    if (depositTransactions.length > 0 && fullTransaction) {
      const depositCurrency = depositTransactions[0].currency;
      if (depositCurrency && fullTransaction.currency !== depositCurrency) {
        throw new Error(
          `Currency conflict: Transaction currency (${fullTransaction.currency}) does not match deposit currency (${depositCurrency})`,
        );
      }
    }

    // Update deposit_id
    await this.updateBankDepositTransaction({
      transactionId,
      depositId,
    });

    // Return updated deposit metadata
    const allDeposits = await this.getAllDepositsWithMetadata();
    const updatedDeposit = allDeposits.find(d => d.id === depositId);

    if (!updatedDeposit) {
      throw new Error('Deposit not found after assignment');
    }

    return updatedDeposit;
  }
}
