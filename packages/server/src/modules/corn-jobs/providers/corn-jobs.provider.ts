import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from 'modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IFlagForeignFeeTransactionsParams,
  IFlagForeignFeeTransactionsQuery,
  IGetReferenceMergeCandidatesParams,
  IGetReferenceMergeCandidatesQuery,
} from '../types.js';

const getReferenceMergeCandidates = sql<IGetReferenceMergeCandidatesQuery>`
  SELECT t.*
  FROM accounter_schema.extended_transactions t
  LEFT JOIN (SELECT COUNT(et.*) AS counter, array_agg(DISTINCT et.charge_id) AS charge_ids, et.source_reference
          FROM accounter_schema.extended_transactions et
          LEFT JOIN accounter_schema.charges c
              ON c.id = et.charge_id
          WHERE c.owner_id = $ownerId
          GROUP BY source_reference ) g
      ON g.source_reference = t.source_reference
  LEFT JOIN accounter_schema.charges c
      ON c.id = t.charge_id

  WHERE c.owner_id = $ownerId
      AND g.counter > 1
      AND array_length(g.charge_ids, 1) > 1
      AND t.source_reference NOT IN (
        SELECT account_number FROM accounter_schema.financial_accounts
        WHERE owner = $ownerId AND type = 'creditcard'
      )
      AND t.source_reference <> '15997109' -- CUSTOM + V.A.T
  ORDER BY t.source_reference;`;

const flagForeignFeeTransactions = sql<IFlagForeignFeeTransactionsQuery>`
  UPDATE accounter_schema.transactions t
  SET is_fee = TRUE
  FROM accounter_schema.extended_transactions et
          LEFT JOIN (SELECT count(et2.*)                      AS counter,
                            array_agg(DISTINCT et2.charge_id) AS charge_ids,
                            et2.source_reference
                      FROM accounter_schema.extended_transactions et2
                              LEFT JOIN accounter_schema.charges c
                                        ON c.id = et2.charge_id
                      WHERE c.owner_id = $ownerId
                      GROUP BY source_reference) g
                    ON g.source_reference = et.source_reference
          LEFT JOIN accounter_schema.charges c
                    ON c.id = et.charge_id
  WHERE et.id = t.id
    AND c.owner_id = $ownerId
    AND g.counter > 1
    AND t.currency <> 'ILS'
    AND t.amount <= 30
    AND t.amount >= -30
    AND t.is_fee IS NULL
    AND t.source_description LIKE '%העברת מט%'
  RETURNING t.id;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class CornJobsProvider {
  constructor(private dbProvider: DBProvider) {}

  public async getReferenceMergeCandidates(params: IGetReferenceMergeCandidatesParams) {
    return getReferenceMergeCandidates.run(params, this.dbProvider);
  }

  public async flagForeignFeeTransactions(params: IFlagForeignFeeTransactionsParams) {
    return flagForeignFeeTransactions.run(params, this.dbProvider);
  }
}
