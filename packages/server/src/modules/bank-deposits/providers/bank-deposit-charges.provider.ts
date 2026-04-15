import DataLoader from 'dataloader';
import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { dateToTimelessDateString, reassureOwnerIdExists } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { identifyInterestTransactionIds } from '../../ledger/helpers/bank-deposit-ledger-generation.helper.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import type {
  BankDepositMetadataProto,
  IGetAllDepositsWithTransactionsQuery,
  IGetBankDepositsByChargeIdsQuery,
  IGetBankDepositsByChargeIdsResult,
  IGetDepositTransactionsByChargeIdQuery,
  IGetTransactionsByBankDepositsQuery,
  IUnlinkChargesFromBankDepositsByChargeIdsQuery,
  IUpsertBankDepositChargeParams,
  IUpsertBankDepositChargeQuery,
} from '../types.js';
import { BankDepositsProvider } from './bank-deposits.provider.js';

const getTransactionsByBankDeposits = sql<IGetTransactionsByBankDepositsQuery>`
    SELECT 
      cbd.new_deposit_id,
      cbd.account_id as deposit_account_id,
      t.*
    FROM accounter_schema.charges_bank_deposits cbd
    INNER JOIN accounter_schema.transactions t
      ON cbd.id = t.charge_id
    WHERE new_deposit_id IN $$depositIds;`;

const getBankDepositsByChargeIds = sql<IGetBankDepositsByChargeIdsQuery>`
  SELECT bd.id, bd.name, bd.currency, bd.account_id, bd.open_date, bd.close_date, cbd.id as charge_id
  FROM accounter_schema.charges_bank_deposits cbd
  INNER JOIN accounter_schema.bank_deposits bd
    ON cbd.new_deposit_id = bd.id
  WHERE cbd.id IN $$chargeIds;`;

const getDepositTransactionsByChargeId = sql<IGetDepositTransactionsByChargeIdQuery>`
    SELECT
      cbd.new_deposit_id,
      cbd.account_id as deposit_account_id,
      t.*
    FROM accounter_schema.charges_bank_deposits cbd
    LEFT JOIN accounter_schema.transactions t
      ON cbd.id = t.charge_id
    WHERE new_deposit_id IN (
      SELECT cbd2.new_deposit_id
      FROM accounter_schema.charges_bank_deposits cbd2
      WHERE cbd2.id = $chargeId
    )
    AND ($includeCharge OR t.charge_id <> $chargeId);`;

const upsertBankDepositCharge = sql<IUpsertBankDepositChargeQuery>`
  INSERT INTO accounter_schema.charges_bank_deposits (id, new_deposit_id, owner_id)
  VALUES ($chargeId, $depositId, $ownerId)
  ON CONFLICT (id) DO UPDATE SET new_deposit_id = EXCLUDED.new_deposit_id, owner_id = EXCLUDED.owner_id;
`;

const unlinkChargesFromBankDepositsByChargeIds = sql<IUnlinkChargesFromBankDepositsByChargeIdsQuery>`
  DELETE FROM accounter_schema.charges_bank_deposits
  WHERE id IN $$chargeIds;
`;

const getAllDepositsWithTransactions = sql<IGetAllDepositsWithTransactionsQuery>`
    SELECT
      bd.id as new_deposit_id,
      bd.name as deposit_name,
      bd.currency as deposit_currency,
      bd.open_date,
      bd.close_date,
      t.*
    FROM accounter_schema.bank_deposits bd
    LEFT JOIN accounter_schema.charges_bank_deposits cbd
        ON cbd.new_deposit_id = bd.id
    LEFT JOIN accounter_schema.transactions t
        ON cbd.id = t.charge_id
    ORDER BY bd.id, COALESCE(t.debit_date, t.event_date);`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class BankDepositChargesProvider {
  constructor(
    private db: TenantAwareDBClient,
    private adminContextProvider: AdminContextProvider,
    private transactionsProvider: TransactionsProvider,
    private bankDepositsProvider: BankDepositsProvider,
  ) {}

  private async batchTransactionsByBankDeposits(depositIds: readonly string[]) {
    const transactions = await getTransactionsByBankDeposits.run(
      {
        depositIds,
      },
      this.db,
    );
    return depositIds.map(id => transactions.filter(t => t.new_deposit_id === id));
  }

  public getTransactionsByBankDepositLoader = new DataLoader((keys: readonly string[]) =>
    this.batchTransactionsByBankDeposits(keys),
  );

  private async batchBankDepositsByChargeIds(chargeIds: readonly string[]) {
    const rows = await getBankDepositsByChargeIds.run(
      { chargeIds: Array.from(new Set(chargeIds)) },
      this.db,
    );
    const chargeIdToDepositMap = new Map<string, IGetBankDepositsByChargeIdsResult>();
    for (const row of rows) {
      if (row.charge_id) {
        chargeIdToDepositMap.set(row.charge_id, row);
      }
    }
    return chargeIds.map(chargeId => chargeIdToDepositMap.get(chargeId) ?? null);
  }

  public getBankDepositByChargeIdLoader = new DataLoader(async (chargeIds: readonly string[]) =>
    this.batchBankDepositsByChargeIds(chargeIds),
  );

  public async getDepositTransactionsByChargeId(chargeId: string, includeCharge = false) {
    return getDepositTransactionsByChargeId.run({ chargeId, includeCharge }, this.db);
  }

  public async upsertBankDepositCharge(params: IUpsertBankDepositChargeParams) {
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    return upsertBankDepositCharge.run(reassureOwnerIdExists(params, ownerId), this.db);
  }

  private async batchBankDepositsMetadata(
    depositIds: readonly string[],
  ): Promise<(BankDepositMetadataProto | Error)[]> {
    const uniqueDepositIds = Array.from(new Set(depositIds));
    const depositsTransactions =
      await this.getTransactionsByBankDepositLoader.loadMany(uniqueDepositIds);

    const depositIdToMetadataMap = new Map<string, BankDepositMetadataProto | Error>();

    for (let i = 0; i < uniqueDepositIds.length; i++) {
      const depositId = uniqueDepositIds[i];
      const transactions = depositsTransactions[i] ?? [];
      if (transactions instanceof Error) {
        depositIdToMetadataMap.set(depositId, transactions);
        continue;
      }
      const interestTransactionIds = identifyInterestTransactionIds(transactions, {
        getId: r => r.id,
        getChargeId: r => r.charge_id,
        getAmount: r => Number(r.amount ?? 0),
      });

      let currentBalance = 0;
      let totalInterest = 0;
      let totalDeposit = 0;
      let potentialCloseDate: Date | null = null;
      const transactionIds: string[] = [];
      for (const tx of transactions) {
        if (!tx.id) continue;
        transactionIds.push(tx.id);
        const amount = Number(tx.amount ?? 0);
        if (interestTransactionIds.has(tx.id)) {
          totalInterest += amount;
        } else {
          currentBalance += amount;
          if (amount > 0) {
            totalDeposit += amount;
          }
        }
        const transactionDate = tx.debit_date ?? tx.event_date;
        if (!potentialCloseDate || transactionDate > potentialCloseDate) {
          potentialCloseDate = transactionDate;
        }
      }

      depositIdToMetadataMap.set(depositId, {
        id: depositId,
        potentialCloseDate: potentialCloseDate
          ? dateToTimelessDateString(potentialCloseDate)
          : null,
        currentBalance,
        totalInterest,
        totalDeposit,
        transactionIds,
      });
    }
    return depositIds.map(id => {
      const metadata = depositIdToMetadataMap.get(id);
      if (!metadata) {
        return {
          id,
          potentialCloseDate: null,
          currentBalance: 0,
          totalInterest: 0,
          totalDeposit: 0,
          transactionIds: [],
        };
      }
      if (metadata instanceof Error) {
        return metadata;
      }
      return metadata;
    });
  }

  public getBankDepositMetadataLoader = new DataLoader(async (depositIds: readonly string[]) =>
    this.batchBankDepositsMetadata(depositIds),
  );

  public async getAllDepositsWithMetadata(): Promise<Array<BankDepositMetadataProto>> {
    const transactionRows = await getAllDepositsWithTransactions.run(undefined, this.db);

    const depositMap = new Map<
      string,
      Omit<BankDepositMetadataProto, 'potentialCloseDate'> & { potentialCloseDate: Date | null }
    >();

    const interestTransactionIds = identifyInterestTransactionIds(transactionRows, {
      getId: r => r.id,
      getChargeId: r => r.charge_id,
      getAmount: r => Number(r.amount ?? 0),
    });

    for (const row of transactionRows) {
      if (!row.new_deposit_id) continue;

      if (!depositMap.has(row.new_deposit_id)) {
        depositMap.set(row.new_deposit_id, {
          id: row.new_deposit_id,
          potentialCloseDate: row.close_date,
          currentBalance: 0,
          totalInterest: 0,
          totalDeposit: 0,
          transactionIds: [],
        });
      }

      if (!row.id) continue;

      const deposit = depositMap.get(row.new_deposit_id)!;
      deposit.transactionIds.push(row.id);

      if (row.amount) {
        const amount = Number(row.amount);
        if (interestTransactionIds.has(row.id)) {
          deposit.totalInterest += amount;
        } else {
          deposit.currentBalance += amount;
          if (amount > 0) {
            deposit.totalDeposit += amount;
          }
        }
      }
    }

    return Array.from(depositMap.values()).map(deposit => ({
      id: deposit.id,
      potentialCloseDate: deposit.potentialCloseDate
        ? dateToTimelessDateString(deposit.potentialCloseDate)
        : null,
      currentBalance: deposit.currentBalance,
      totalInterest: deposit.totalInterest,
      totalDeposit: deposit.totalDeposit,
      transactionIds: deposit.transactionIds,
    }));
  }

  public async unlinkChargesFromBankDepositsByChargeIds(chargeIds: string[]) {
    return unlinkChargesFromBankDepositsByChargeIds.run({ chargeIds }, this.db);
  }

  public async assignChargeToDeposit(chargeId: string, depositId: string) {
    const [deposit, transactions] = await Promise.all([
      // Get target deposit transactions to validate currency
      this.bankDepositsProvider.bankDepositByIdLoader.load(depositId),
      this.transactionsProvider.transactionsByChargeIDLoader.load(chargeId),
    ]);

    if (!deposit) {
      throw new GraphQLError(`Deposit ${depositId} not found`);
    }

    if (transactions.length < 1) {
      throw new GraphQLError(`No transactions found for charge ID="${chargeId}"`);
    }

    let accountId = deposit.account_id;
    let currency = deposit.currency;

    // Check currency or account conflict
    for (const transaction of transactions) {
      if (!accountId || !currency) {
        accountId ??= transaction.account_id;
        currency ??= transaction.currency;
        await this.bankDepositsProvider.updateBankDeposit({
          depositId: deposit.id,
          accountId,
          currency,
        });
      }
      if (accountId !== transaction.account_id) {
        throw new Error(`Account conflict: Transactions accounts are inconsistent`);
      }
      if (currency !== transaction.currency) {
        throw new Error(`Currency conflict: Transactions currencies are inconsistent`);
      }
    }

    await this.upsertBankDepositCharge({ chargeId, depositId });
  }
}
