import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { SecurityPaymentType, SecurityTradeType } from '../../../shared/enums.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { paymentTypeToRaw, tradeTypeToRaw } from '../helpers/security-execution-enums.helper.js';
import type {
  IGetChargeIdsByExecutionIdsQuery,
  IGetExecutionIdsByChargeIdsQuery,
  IGetUnlinkedDistributionsQuery,
  IInsertChargeSecurityExecutionQuery,
  IReplaceChargeSecurityExecutionsChargeIdQuery,
} from '../types.js';

/**
 * `accounter_schema.charges_securities_executions`: the executions a charge books directly,
 * because they have no cash leg for the usual transaction pairing to find (see the migration that
 * creates the table). The executions themselves are read through `ForeignSecuritiesProvider`,
 * which owns the execution column list; this provider owns the link.
 */

const getExecutionIdsByChargeIds = sql<IGetExecutionIdsByChargeIdsQuery>`
  SELECT execution_id, charge_id
  FROM accounter_schema.charges_securities_executions
  WHERE charge_id = ANY($chargeIds!);`;

const getChargeIdsByExecutionIds = sql<IGetChargeIdsByExecutionIdsQuery>`
  SELECT execution_id, charge_id
  FROM accounter_schema.charges_securities_executions
  WHERE execution_id = ANY($executionIds!);`;

const replaceChargeSecurityExecutionsChargeId = sql<IReplaceChargeSecurityExecutionsChargeIdQuery>`
  UPDATE accounter_schema.charges_securities_executions
  SET charge_id = $assertChargeID
  WHERE charge_id = $replaceChargeID
  RETURNING execution_id, charge_id;`;

/**
 * The owner's live distributions that no charge books yet. `owner_id` is filtered explicitly:
 * reads follow the request's whole business scope, and the charges are created for one owner.
 * Executions on or before the ledger lock are left alone — a charge with no transactions is never
 * considered locked, so a new one there would book into a closed period.
 */
const getUnlinkedDistributions = sql<IGetUnlinkedDistributionsQuery>`
  SELECT t.id, t.symbol, t.eng_name, t.security, t.nv
  FROM accounter_schema.poalim_securities_transactions t
  LEFT JOIN accounter_schema.charges_securities_executions l
    ON l.execution_id = t.id
  WHERE l.execution_id IS NULL
    AND t.owner_id = $ownerId!
    AND t.trade_type = $tradeType!
    AND t.payment_type = $paymentType!
    AND t.is_cancel_transaction IS DISTINCT FROM $cancelledFlag!
    AND ($ledgerLock::DATE IS NULL OR COALESCE(t.value_date, t.trade_date) > $ledgerLock::DATE)
  ORDER BY t.trade_date, t.id;`;

const insertChargeSecurityExecution = sql<IInsertChargeSecurityExecutionQuery>`
  INSERT INTO accounter_schema.charges_securities_executions (execution_id, charge_id, owner_id)
  VALUES ($executionId!, $chargeId!, $ownerId!)
  ON CONFLICT (execution_id) DO NOTHING
  RETURNING execution_id;`;

/** The bank's `IsCancelTransaction` flag on a cancelled execution — see `isCancelledExecution` */
const CANCELLED_FLAG = 'כן';

/** Thrown to roll back a charge whose execution another run linked first */
class AlreadyLinkedError extends Error {}

function distributionChargeDescription(execution: {
  symbol: string | null;
  eng_name: string | null;
  security: string;
}): string {
  const name = execution.symbol?.trim() || execution.eng_name?.trim() || execution.security;
  return `Stock distribution: ${name}`;
}

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class SecurityExecutionChargesProvider {
  constructor(
    private db: TenantAwareDBClient,
    private chargesProvider: ChargesProvider,
  ) {}

  private async batchExecutionIdsByChargeIds(chargeIds: readonly string[]): Promise<string[][]> {
    const rows = await getExecutionIdsByChargeIds.run(
      { chargeIds: [...new Set(chargeIds)] },
      this.db,
    );
    const byChargeId = new Map<string, string[]>();
    for (const { charge_id, execution_id } of rows) {
      const executionIds = byChargeId.get(charge_id);
      if (executionIds) {
        executionIds.push(execution_id);
      } else {
        byChargeId.set(charge_id, [execution_id]);
      }
    }
    return chargeIds.map(chargeId => byChargeId.get(chargeId) ?? []);
  }

  /** The ids of the executions each charge books directly — empty for an ordinary charge */
  public linkedExecutionIdsByChargeIdLoader = new DataLoader((chargeIds: readonly string[]) =>
    this.batchExecutionIdsByChargeIds(chargeIds),
  );

  private async batchChargeIdsByExecutionIds(
    executionIds: readonly string[],
  ): Promise<(string | null)[]> {
    const rows = await getChargeIdsByExecutionIds.run(
      { executionIds: [...new Set(executionIds)] },
      this.db,
    );
    const chargeIdByExecutionId = new Map(rows.map(row => [row.execution_id, row.charge_id]));
    return executionIds.map(executionId => chargeIdByExecutionId.get(executionId) ?? null);
  }

  /** The charge that books each execution directly, or null when none does */
  public chargeIdByExecutionIdLoader = new DataLoader((executionIds: readonly string[]) =>
    this.batchChargeIdsByExecutionIds(executionIds),
  );

  /** Moves every link of one charge to another — the merge counterpart of the other content tables */
  public async replaceChargeId(params: { replaceChargeID: string; assertChargeID: string }) {
    const moved = await replaceChargeSecurityExecutionsChargeId.run(params, this.db);
    this.linkedExecutionIdsByChargeIdLoader.clear(params.replaceChargeID);
    this.linkedExecutionIdsByChargeIdLoader.clear(params.assertChargeID);
    for (const { execution_id } of moved) {
      this.chargeIdByExecutionIdLoader.clear(execution_id);
    }
    return moved;
  }

  /**
   * Creates a charge for each of the owner's stock distributions paid as a dividend in kind that
   * no charge books yet, and links the two. The charge is what the distribution's income entry is
   * generated in — it has no cash transaction to be found through.
   *
   * Only dividends in kind: they are income at the value of the shares received. A bonus issue or
   * a split of the same company is not, and moves the cost of the existing holding instead — none
   * has been seen yet, so they are deliberately left unlinked until one is.
   *
   * Owner-wide rather than per upload, so a distribution ingested before this existed is picked
   * up by the next upload too. Each charge and its link are written together: when another run
   * linked the execution first, the charge is rolled back rather than left empty (the scraper
   * cannot delete charges).
   *
   * Returns the ids of the charges created.
   */
  public async ensureDistributionCharges(
    ownerId: string,
    ledgerLock: TimelessDateString | null,
  ): Promise<string[]> {
    const distributions = await getUnlinkedDistributions.run(
      {
        ownerId,
        tradeType: tradeTypeToRaw[SecurityTradeType.StockDistribution],
        paymentType: paymentTypeToRaw[SecurityPaymentType.DividendInKind],
        cancelledFlag: CANCELLED_FLAG,
        ledgerLock,
      },
      this.db,
    );

    const chargeIds: string[] = [];
    for (const distribution of distributions) {
      try {
        const chargeId = await this.db.transaction(async client => {
          const charge = await this.chargesProvider.generateCharge(
            {
              ownerId,
              type: 'FOREIGN_SECURITIES',
              userDescription: distributionChargeDescription(distribution),
            },
            client,
          );
          if (!charge?.id) {
            throw new Error(
              `Failed to create a charge for securities execution ${distribution.id}`,
            );
          }
          const [link] = await insertChargeSecurityExecution.run(
            { executionId: distribution.id, chargeId: charge.id, ownerId },
            client,
          );
          if (!link) {
            throw new AlreadyLinkedError();
          }
          return charge.id;
        });
        chargeIds.push(chargeId);
      } catch (e) {
        if (!(e instanceof AlreadyLinkedError)) {
          throw e;
        }
      }
    }

    if (chargeIds.length > 0) {
      this.linkedExecutionIdsByChargeIdLoader.clearAll();
      this.chargeIdByExecutionIdLoader.clearAll();
    }
    return chargeIds;
  }
}
