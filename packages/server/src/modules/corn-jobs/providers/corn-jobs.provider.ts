import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { DBProvider } from '../../../modules/app-providers/db.provider.js';
import type {
  ICalculateCreditcardDebitDateParams,
  ICalculateCreditcardDebitDateQuery,
  IFlagForeignFeeTransactionsParams,
  IFlagForeignFeeTransactionsQuery,
  IGetReferenceMergeCandidatesParams,
  IGetReferenceMergeCandidatesQuery,
} from '../types.js';

const getReferenceMergeCandidates = sql<IGetReferenceMergeCandidatesQuery>`
  SELECT t.*
  FROM accounter_schema.transactions t
  LEFT JOIN (SELECT COUNT(et.*) AS counter, array_agg(DISTINCT et.charge_id) AS charge_ids, et.source_reference
          FROM accounter_schema.transactions et
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
        WHERE owner = $ownerId AND type = 'CREDIT_CARD'
      )
      AND t.source_reference <> '15997109' -- CUSTOM + V.A.T
  ORDER BY t.source_reference;`;

const flagForeignFeeTransactions = sql<IFlagForeignFeeTransactionsQuery>`
  UPDATE accounter_schema.transactions t
  SET is_fee = TRUE
  FROM (SELECT t.id
        FROM accounter_schema.transactions t
                LEFT JOIN (SELECT count(t2.*)                      AS counter,
                                  array_agg(DISTINCT t2.charge_id) AS charge_ids,
                                  t2.source_reference
                            FROM accounter_schema.transactions t2
                                    LEFT JOIN accounter_schema.charges c2
                                              ON c2.id = t2.charge_id
                            WHERE c2.owner_id = $ownerId
                            GROUP BY source_reference) g
                          ON g.source_reference = t.source_reference
                LEFT JOIN accounter_schema.charges c
                          ON c.id = t.charge_id
        WHERE t.is_fee IS FALSE
          AND c.owner_id = $ownerId
          AND g.counter > 1
          AND t.currency <> 'ILS'
          AND t.amount <= 30
          AND t.amount >= -30
          AND t.source_description LIKE '%העברת מט%') matches
  WHERE t.id = matches.id
  RETURNING t.id;`;

const calculateCreditcardDebitDate = sql<ICalculateCreditcardDebitDateQuery>`
WITH alt_debit_date AS (SELECT p.event_date,
                               p.reference_number::text
                        FROM accounter_schema.poalim_ils_account_transactions p
                        WHERE p.activity_type_code = 491
                        ORDER BY p.event_date DESC),
     altered_transactions AS (SELECT DISTINCT ON (t.id) t.id,
                                                        alt_debit_date.event_date AS alt_debit_date,
                                                        c.owner_id
                              FROM accounter_schema.transactions t
                                       LEFT JOIN accounter_schema.financial_accounts a ON a.id = t.account_id
                                       LEFT JOIN accounter_schema.charges c ON c.id = t.charge_id
                                       LEFT JOIN alt_debit_date
                                                 ON alt_debit_date.reference_number = a.account_number AND
                                                    alt_debit_date.event_date > t.event_date AND
                                                    alt_debit_date.event_date < (t.event_date + '40 days'::interval) AND
                                                    alt_debit_date.event_date = ((SELECT min(add.event_date) AS min
                                                                                  FROM alt_debit_date add
                                                                                  WHERE add.reference_number = a.account_number
                                                                                    AND add.event_date > t.event_date
                                                                                    AND add.event_date < (t.event_date + '40 days'::interval)))
                              WHERE t.debit_date IS NULL
                                AND t.debit_date_override IS NULL
                                AND currency = 'ILS'
                                AND (t.source_origin = 'ISRACARD' OR t.source_origin = 'AMEX'))
UPDATE accounter_schema.transactions t
SET debit_date_override = at.alt_debit_date
FROM altered_transactions at
where at.id = t.id
  AND t.debit_date IS NULL
  AND t.debit_date_override IS NULL
  AND at.alt_debit_date IS NOT NULL
  AND at.owner_id = $ownerId;`;

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

  public async calculateCreditcardDebitDate(params: ICalculateCreditcardDebitDateParams) {
    return calculateCreditcardDebitDate.run(params, this.dbProvider);
  }
}
