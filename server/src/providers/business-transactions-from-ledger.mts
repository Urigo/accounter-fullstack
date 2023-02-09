import pgQuery, { TaggedQuery } from '@pgtyped/query';
import { IDatabaseConnection } from '@pgtyped/query/lib/tag.js';
import {
  IGetBusinessTransactionsFromLedgerRecordsQuery,
  IGetBusinessTransactionsSumFromLedgerRecordsParams,
  IGetBusinessTransactionsSumFromLedgerRecordsQuery,
  IGetBusinessTransactionsSumFromLedgerRecordsResult,
  IGetLedgerRecordsDistinctBusinessesQuery,
} from '../__generated__/business-transactions-from-ledger.types.mjs';
import { isTimelessDateString, Optional } from '../helpers/misc.mjs';
import { TimelessDateString } from '../scalars/index.js';

const { sql } = pgQuery;

export const getLedgerRecordsDistinctBusinesses = sql<IGetLedgerRecordsDistinctBusinessesQuery>`
  SELECT DISTINCT business_name FROM (SELECT debit_account_1 as business_name FROM accounter_schema.ledger
  UNION
  SELECT debit_account_2 FROM accounter_schema.ledger
  UNION
  SELECT credit_account_1 FROM accounter_schema.ledger
  UNION
  SELECT credit_account_2 FROM accounter_schema.ledger) as bu
  ORDER BY bu.business_name;`;

export const getBusinessTransactionsFromLedgerRecords = sql<IGetBusinessTransactionsFromLedgerRecordsQuery>`
  SELECT * 
  FROM (SELECT debit_account_1 AS business_name, to_date(invoice_date, 'DD/MM/YYYY') AS invoice_date, debit_amount_1 AS amount, foreign_debit_amount_1 AS foreign_amount, -1 AS direction, business AS financial_entity_id, currency, reference_1, reference_2, details, credit_account_1 as counter_account FROM accounter_schema.ledger
    UNION ALL
    SELECT debit_account_2, to_date(invoice_date, 'DD/MM/YYYY'), debit_amount_2, foreign_debit_amount_2, -1, business AS financial_entity_id, currency, reference_1, reference_2, details, credit_account_1 FROM accounter_schema.ledger
    UNION ALL
    SELECT credit_account_1, to_date(invoice_date, 'DD/MM/YYYY'), credit_amount_1, foreign_credit_amount_1, 1, business AS financial_entity_id, currency, reference_1, reference_2, details, debit_account_1 FROM accounter_schema.ledger
    UNION ALL
    SELECT credit_account_2, to_date(invoice_date, 'DD/MM/YYYY'), credit_amount_2, foreign_credit_amount_2, 1, business AS financial_entity_id, currency, reference_1, reference_2, details, debit_account_1 FROM accounter_schema.ledger) AS bu
  WHERE bu.business_name IS NOT NULL AND bu.business_name <> ''
    AND ($isFinancialEntityIds = 0 OR bu.financial_entity_id IN $$financialEntityIds)
    AND ($fromDate::TEXT IS NULL OR bu.invoice_date >= $fromDate::DATE)
    AND ($toDate::TEXT IS NULL OR bu.invoice_date <= $toDate::DATE)
    AND ($isBusinessNames = 0 OR bu.business_name IN $$businessNames)
  ORDER BY bu.invoice_date;`;

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
const getBusinessTransactionsSumFromLedgerRecords = sql<IGetBusinessTransactionsSumFromLedgerRecordsQuery>`
SELECT *
FROM (SELECT debit_account_1 AS business_name, to_date(invoice_date, 'DD/MM/YYYY') AS invoice_date, debit_amount_1 AS amount, foreign_debit_amount_1 AS foreign_amount, -1 AS direction, business AS financial_entity_id, currency FROM accounter_schema.ledger
  UNION ALL
  SELECT debit_account_2, to_date(invoice_date, 'DD/MM/YYYY'), debit_amount_2, foreign_debit_amount_2, -1, business AS financial_entity_id, currency FROM accounter_schema.ledger
  UNION ALL
  SELECT credit_account_1, to_date(invoice_date, 'DD/MM/YYYY'), credit_amount_1, foreign_credit_amount_1, 1, business AS financial_entity_id, currency FROM accounter_schema.ledger
  UNION ALL
  SELECT credit_account_2, to_date(invoice_date, 'DD/MM/YYYY'), credit_amount_2, foreign_credit_amount_2, 1, business AS financial_entity_id, currency FROM accounter_schema.ledger) AS bu
WHERE bu.business_name IS NOT NULL AND bu.business_name <> ''
  AND ($isFinancialEntityIds = 0 OR bu.financial_entity_id IN $$financialEntityIds)
  AND ($fromDate::TEXT IS NULL OR bu.invoice_date >= $fromDate::DATE)
  AND ($toDate::TEXT IS NULL OR bu.invoice_date <= $toDate::DATE)
  AND ($isBusinessNames = 0 OR bu.business_name IN $$businessNames)
ORDER BY bu.business_name;`;

type IGetBusinessTransactionsSumFromLedgerRecordsParamsAdjusted = Optional<
  Omit<
    IGetBusinessTransactionsSumFromLedgerRecordsParams,
    'isBusinessNames' | 'isFinancialEntityIds'
  >,
  'businessNames' | 'financialEntityIds' | 'toDate' | 'fromDate'
> & {
  toDate?: TimelessDateString | null;
  fromDate?: TimelessDateString | null;
};

const getBusinessTransactionsSumFromLedgerRecordsAdjusted: Pick<
  TaggedQuery<{
    params: IGetBusinessTransactionsSumFromLedgerRecordsParamsAdjusted | null | undefined;
    result: IGetBusinessTransactionsSumFromLedgerRecordsResult;
  }>,
  'run'
> = {
  run(params, dbConnection: IDatabaseConnection) {
    const isFinancialEntityIds = params?.financialEntityIds?.length ?? 0;
    const isBusinessNames = params?.businessNames?.length ?? 0;
    const adjustedFilters: IGetBusinessTransactionsSumFromLedgerRecordsParams = {
      isBusinessNames,
      businessNames: isBusinessNames > 0 ? (params?.businessNames as string[]) : [null],
      isFinancialEntityIds,
      financialEntityIds:
        isFinancialEntityIds > 0 ? (params?.financialEntityIds as string[]) : [null],
      fromDate: isTimelessDateString(params?.fromDate ?? '')
        ? (params?.fromDate as TimelessDateString)
        : null,
      toDate: isTimelessDateString(params?.toDate ?? '')
        ? (params?.toDate as TimelessDateString)
        : null,
    };
    return getBusinessTransactionsSumFromLedgerRecords.run(adjustedFilters, dbConnection);
  },
};

export { getBusinessTransactionsSumFromLedgerRecordsAdjusted as getBusinessTransactionsSumFromLedgerRecords };
