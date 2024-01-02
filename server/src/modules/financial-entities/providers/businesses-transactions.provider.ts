import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
// import { isTimelessDateString } from '@shared/helpers';
// import type { Optional, TimelessDateString } from '@shared/types';
import type {
  // IGetBusinessTransactionsFromLedgerRecordsParams,
  // IGetBusinessTransactionsFromLedgerRecordsQuery,
  // IGetBusinessTransactionsSumFromLedgerRecordsParams,
  // IGetBusinessTransactionsSumFromLedgerRecordsQuery,
  IGetLedgerRecordsDistinctBusinessesParams,
  IGetLedgerRecordsDistinctBusinessesQuery,
} from '../types.js';

const getLedgerRecordsDistinctBusinesses = sql<IGetLedgerRecordsDistinctBusinessesQuery>`
  SELECT DISTINCT business_id
  FROM (SELECT debit_account_id_1 as business_id
    FROM accounter_schema.ledger
    UNION
    SELECT debit_account_id_2
    FROM accounter_schema.ledger
    UNION
    SELECT credit_account_id_1
    FROM accounter_schema.ledger
    UNION
    SELECT credit_account_id_2
    FROM accounter_schema.ledger) as bu
ORDER BY bu.business_id;`;

// const getBusinessTransactionsFromLedgerRecords = sql<IGetBusinessTransactionsFromLedgerRecordsQuery>`
//   SELECT bu.*
//   FROM (SELECT debit_account_id_1 AS business_id, to_date(invoice_date, 'DD/MM/YYYY') AS invoice_date, debit_amount_1 AS amount, foreign_debit_amount_1 AS foreign_amount, -1 AS direction, business AS financial_entity_id, currency, reference_1, reference_2, details, credit_account_id_1 as counter_account_id FROM accounter_schema.ledger
//     UNION ALL
//     SELECT debit_account_id_2, to_date(invoice_date, 'DD/MM/YYYY'), debit_amount_2, foreign_debit_amount_2, -1, business AS financial_entity_id, currency, reference_1, reference_2, details, credit_account_id_1 FROM accounter_schema.ledger
//     UNION ALL
//     SELECT credit_account_id_1, to_date(invoice_date, 'DD/MM/YYYY'), credit_amount_1, foreign_credit_amount_1, 1, business AS financial_entity_id, currency, reference_1, reference_2, details, debit_account_id_1 FROM accounter_schema.ledger
//     UNION ALL
//     SELECT credit_account_id_2, to_date(invoice_date, 'DD/MM/YYYY'), credit_amount_2, foreign_credit_amount_2, 1, business AS financial_entity_id, currency, reference_1, reference_2, details, debit_account_id_1 FROM accounter_schema.ledger) AS bu
//   WHERE bu.business_id IS NOT NULL
//     AND ($isFinancialEntityIds = 0 OR bu.financial_entity_id IN $$financialEntityIds)
//     AND ($fromDate::TEXT IS NULL OR bu.invoice_date >= $fromDate::DATE)
//     AND ($toDate::TEXT IS NULL OR bu.invoice_date <= $toDate::DATE)
//     AND ($isBusinessIDs = 0 OR bu.business_id IN $$businessIDs)
//   ORDER BY bu.invoice_date;`;

// export const getBusinessTransactionsSumFromLedgerRecords = sql<IGetBusinessTransactionsSumFromLedgerRecordsQuery>`
//   SELECT business_name,
//     SUM(CASE WHEN direction > 0 THEN CAST((COALESCE(amount, '0')) AS DECIMAL) ELSE 0 END) as credit,
//     SUM(CASE WHEN direction < 0 THEN CAST((COALESCE(amount, '0')) AS DECIMAL) ELSE 0 END) as debit,
//     SUM(CAST((COALESCE(amount, '0')) AS DECIMAL) * direction) as total,
//     SUM(CASE WHEN direction > 0 AND currency = 'אירו' THEN CAST((COALESCE(foreign_amount, '0')) AS DECIMAL) ELSE 0 END) as eur_credit,
//     SUM(CASE WHEN direction < 0 AND currency = 'אירו' THEN CAST((COALESCE(foreign_amount, '0')) AS DECIMAL) ELSE 0 END) as eur_debit,
//     SUM(CASE WHEN currency = 'אירו' THEN CAST((COALESCE(foreign_amount, '0')) AS DECIMAL) * direction ELSE 0 END) as eur_total,
//     SUM(CASE WHEN direction > 0 AND currency = 'לש' THEN CAST((COALESCE(foreign_amount, '0')) AS DECIMAL) ELSE 0 END) as gbp_credit,
//     SUM(CASE WHEN direction < 0 AND currency = 'לש' THEN CAST((COALESCE(foreign_amount, '0')) AS DECIMAL) ELSE 0 END) as gbp_debit,
//     SUM(CASE WHEN currency = 'לש' THEN CAST((COALESCE(foreign_amount, '0')) AS DECIMAL) * direction ELSE 0 END) as gbp_total,
//     SUM(CASE WHEN direction > 0 AND currency = '$' THEN CAST((COALESCE(foreign_amount, '0')) AS DECIMAL) ELSE 0 END) as usd_credit,
//     SUM(CASE WHEN direction < 0 AND currency = '$' THEN CAST((COALESCE(foreign_amount, '0')) AS DECIMAL) ELSE 0 END) as usd_debit,
//     SUM(CASE WHEN currency = '$' THEN CAST((COALESCE(foreign_amount, '0')) AS DECIMAL) * direction ELSE 0 END) as usd_total
//   FROM (SELECT debit_account_1 AS business_name, to_date(invoice_date, 'DD/MM/YYYY') AS invoice_date, debit_amount_1 AS amount, foreign_debit_amount_1 AS foreign_amount, -1 AS direction, business AS financial_entity_id, currency FROM accounter_schema.ledger
//     UNION ALL
//     SELECT debit_account_2, to_date(invoice_date, 'DD/MM/YYYY'), debit_amount_2, foreign_debit_amount_2, -1, business AS financial_entity_id, currency FROM accounter_schema.ledger
//     UNION ALL
//     SELECT credit_account_1, to_date(invoice_date, 'DD/MM/YYYY'), credit_amount_1, foreign_credit_amount_1, 1, business AS financial_entity_id, currency FROM accounter_schema.ledger
//     UNION ALL
//     SELECT credit_account_2, to_date(invoice_date, 'DD/MM/YYYY'), credit_amount_2, foreign_credit_amount_2, 1, business AS financial_entity_id, currency FROM accounter_schema.ledger) AS bu
//   WHERE bu.business_name IS NOT NULL AND bu.business_name <> ''
//     AND ($isFinancialEntityIds = 0 OR bu.financial_entity_id IN $$financialEntityIds)
//     AND ($fromDate::TEXT IS NULL OR bu.invoice_date >= $fromDate::DATE)
//     AND ($toDate::TEXT IS NULL OR bu.invoice_date <= $toDate::DATE)
//     AND ($isBusinessNames = 0 OR bu.business_name IN $$businessNames)
//   GROUP BY bu.business_name
//   ORDER BY bu.business_name;`;

// NOTE: Using this query instead of the one above because pgtypes doesn't support not-latin characters like 'אירו' and 'לש'
// const getBusinessTransactionsSumFromLedgerRecords = sql<IGetBusinessTransactionsSumFromLedgerRecordsQuery>`
// SELECT bu.*, b.name AS business_name
// FROM (SELECT debit_account_id_1 AS business_id, to_date(invoice_date, 'DD/MM/YYYY') AS invoice_date, debit_amount_1 AS amount, foreign_debit_amount_1 AS foreign_amount, -1 AS direction, business AS financial_entity_id, currency FROM accounter_schema.ledger
//   UNION ALL
//   SELECT debit_account_id_2, to_date(invoice_date, 'DD/MM/YYYY'), debit_amount_2, foreign_debit_amount_2, -1, business AS financial_entity_id, currency FROM accounter_schema.ledger
//   UNION ALL
//   SELECT credit_account_id_1, to_date(invoice_date, 'DD/MM/YYYY'), credit_amount_1, foreign_credit_amount_1, 1, business AS financial_entity_id, currency FROM accounter_schema.ledger
//   UNION ALL
//   SELECT credit_account_id_2, to_date(invoice_date, 'DD/MM/YYYY'), credit_amount_2, foreign_credit_amount_2, 1, business AS financial_entity_id, currency FROM accounter_schema.ledger) AS bu
// LEFT JOIN accounter_schema.businesses AS b
// ON bu.business_id = b.id
// WHERE bu.business_id IS NOT NULL
//   AND ($isFinancialEntityIds = 0 OR bu.financial_entity_id IN $$financialEntityIds)
//   AND ($fromDate::TEXT IS NULL OR bu.invoice_date >= $fromDate::DATE)
//   AND ($toDate::TEXT IS NULL OR bu.invoice_date <= $toDate::DATE)
//   AND ($isBusinessIDs = 0 OR bu.business_id IN $$businessIDs)
// ORDER BY bu.business_id;`;

// type IGetBusinessTransactionsSumFromLedgerRecordsParamsAdjusted = Optional<
//   Omit<
//     IGetBusinessTransactionsSumFromLedgerRecordsParams,
//     'isBusinessIDs' | 'isFinancialEntityIds'
//   >,
//   'businessIDs' | 'financialEntityIds' | 'toDate' | 'fromDate'
// > & {
//   toDate?: TimelessDateString | null;
//   fromDate?: TimelessDateString | null;
// };

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessesTransactionsProvider {
  constructor(private dbProvider: DBProvider) {}

  public getLedgerRecordsDistinctBusinesses(params: IGetLedgerRecordsDistinctBusinessesParams) {
    return getLedgerRecordsDistinctBusinesses.run(params, this.dbProvider);
  }

  // public getBusinessTransactionsFromLedgerRecords(
  //   params: IGetBusinessTransactionsFromLedgerRecordsParams,
  // ) {
  //   return getBusinessTransactionsFromLedgerRecords.run(params, this.dbProvider);
  // }

  // public getBusinessTransactionsSumFromLedgerRecords(
  //   params: IGetBusinessTransactionsSumFromLedgerRecordsParamsAdjusted | null | undefined,
  // ) {
  //   const isFinancialEntityIds = params?.financialEntityIds?.length ?? 0;
  //   const isBusinessIDs = params?.businessIDs?.length ?? 0;
  //   const adjustedFilters: IGetBusinessTransactionsSumFromLedgerRecordsParams = {
  //     isBusinessIDs,
  //     businessIDs: isBusinessIDs > 0 ? (params?.businessIDs as string[]) : [null],
  //     isFinancialEntityIds,
  //     financialEntityIds:
  //       isFinancialEntityIds > 0 ? (params?.financialEntityIds as string[]) : [null],
  //     fromDate: isTimelessDateString(params?.fromDate ?? '')
  //       ? (params?.fromDate as TimelessDateString)
  //       : null,
  //     toDate: isTimelessDateString(params?.toDate ?? '')
  //       ? (params?.toDate as TimelessDateString)
  //       : null,
  //   };
  //   return getBusinessTransactionsSumFromLedgerRecords.run(adjustedFilters, this.dbProvider);
  // }
}
