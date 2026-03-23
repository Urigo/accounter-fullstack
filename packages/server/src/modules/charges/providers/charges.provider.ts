import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql, type IDatabaseConnection } from '@pgtyped/runtime';
import type { Optional, TimelessDateString } from '../../../shared/types/index.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  accountant_status,
  IBatchUpdateChargesParams,
  IBatchUpdateChargesQuery,
  IDeleteChargesByIdsParams,
  IDeleteChargesByIdsQuery,
  IGenerateChargeParams,
  IGenerateChargeQuery,
  IGetChargesByFiltersParams,
  IGetChargesByFiltersQuery,
  IGetChargesByFiltersResult,
  IGetChargesByIdsQuery,
  IGetChargesByMissingRequiredInfoQuery,
  IGetChargesByTransactionIdsQuery,
  IGetSimilarChargesParams,
  IGetSimilarChargesQuery,
  IUpdateAccountantApprovalParams,
  IUpdateAccountantApprovalQuery,
  IUpdateChargeParams,
  IUpdateChargeQuery,
} from '../types.js';
import { ChargesAuthorizationProvider } from './charges-authorization.provider.js';

export type ChargeRequiredWrapper<
  T extends {
    id: unknown;
    owner_id: unknown;
    is_property: unknown;
    accountant_status: unknown;
    updated_at: unknown;
    created_at: unknown;
    documents_optional_flag: unknown;
    optional_vat: unknown;
  },
> = Omit<
  T,
  | 'id'
  | 'owner_id'
  | 'is_property'
  | 'accountant_status'
  | 'updated_at'
  | 'created_at'
  | 'documents_optional_flag'
  | 'optional_vat'
> & {
  id: NonNullable<T['id']>;
  owner_id: NonNullable<T['owner_id']>;
  is_property: NonNullable<T['is_property']>;
  accountant_status: NonNullable<T['accountant_status']>;
  updated_at: NonNullable<T['updated_at']>;
  created_at: NonNullable<T['created_at']>;
  documents_optional_flag: NonNullable<T['documents_optional_flag']>;
  optional_vat: NonNullable<T['optional_vat']>;
};

const getChargesByIds = sql<IGetChargesByIdsQuery>`
    SELECT *
    FROM accounter_schema.charges
    WHERE id IN $$chargeIds;`;

const getChargesByTransactionIds = sql<IGetChargesByTransactionIdsQuery>`
    SELECT t.id AS transaction_id, c.* FROM accounter_schema.transactions t
    LEFT JOIN accounter_schema.charges c
      ON t.charge_id = c.id
    WHERE t.id IN $$transactionIds;`;

const getChargesByMissingRequiredInfo = sql<IGetChargesByMissingRequiredInfoQuery>`
    SELECT c.*
    FROM accounter_schema.charges c
    LEFT JOIN accounter_schema.charge_tags t
      ON t.charge_id = c.id
    WHERE c.user_description IS NULL
    OR t.tag_id IS NULL;`;

const updateCharge = sql<IUpdateChargeQuery>`
  UPDATE accounter_schema.charges
  SET
  user_description = COALESCE(
    $userDescription,
    user_description
  ),
  type = COALESCE(
    $type,
    type
  ),
  invoice_payment_currency_diff = COALESCE(
    $isInvoicePaymentDifferentCurrency,
    invoice_payment_currency_diff
  ),
  accountant_status = COALESCE(
    $accountantStatus,
    accountant_status
  ),
  tax_category_id = COALESCE(
    $taxCategoryId,
    tax_category_id
  ),
  optional_vat = COALESCE(
    $optionalVAT,
    optional_vat
  ),
  documents_optional_flag = COALESCE(
    $optionalDocuments,
    documents_optional_flag
  ),
  is_property = COALESCE(
    $isProperty,
    is_property
  )
  WHERE
    id = $chargeId
  RETURNING *;
`;

const batchUpdateCharges = sql<IBatchUpdateChargesQuery>`
  UPDATE accounter_schema.charges
  SET
  user_description = COALESCE(
    $userDescription,
    user_description
  ),
  type = COALESCE(
    $type,
    type
  ),
  invoice_payment_currency_diff = COALESCE(
    $isInvoicePaymentDifferentCurrency,
    invoice_payment_currency_diff
  ),
  accountant_status = COALESCE(
    $accountantStatus,
    accountant_status
  ),
  tax_category_id = COALESCE(
    $taxCategoryId,
    tax_category_id
  ),
  optional_vat = COALESCE(
    $optionalVAT,
    optional_vat
  ),
  documents_optional_flag = COALESCE(
    $optionalDocuments,
    documents_optional_flag
  ),
  is_property = COALESCE(
    $isProperty,
    is_property
  )
  WHERE
    id in $$chargeIds
  RETURNING *;
`;

const updateAccountantApproval = sql<IUpdateAccountantApprovalQuery>`
  UPDATE accounter_schema.charges
  SET
    accountant_status = $accountantStatus
  WHERE
    id = $chargeId
  RETURNING *;
`;

const generateCharge = sql<IGenerateChargeQuery>`
  INSERT INTO accounter_schema.charges (owner_id, type, accountant_status, user_description, tax_category_id, optional_vat, documents_optional_flag, is_property)
  VALUES ($ownerId, $type, $accountantStatus, $userDescription, $taxCategoryId, $optionalVAT, $optionalDocuments, $isProperty)
  RETURNING *;
`;

const getChargesByFilters = sql<IGetChargesByFiltersQuery>`
  WITH search_matches AS (
    -- Strategy: Identify IDs via Trigram indexes before doing any heavy math
    SELECT id FROM accounter_schema.charges 
    WHERE ($freeText::TEXT IS NULL OR user_description ILIKE '%' || $freeText || '%')
    UNION
    SELECT charge_id FROM accounter_schema.transactions 
    WHERE ($freeText::TEXT IS NULL OR source_description ILIKE '%' || $freeText || '%')
    UNION
    SELECT charge_id FROM accounter_schema.documents 
    WHERE ($freeText::TEXT IS NULL OR description ILIKE '%' || $freeText || '%')
  ),
  filtered_charges AS MATERIALIZED (
    -- This is our "source of truth" for the rest of the query
    SELECT c.*
    FROM accounter_schema.charges c
    INNER JOIN search_matches sm ON c.id = sm.id 
    WHERE ($isIDs = 0 OR c.id IN $$IDs)
      AND ($isOwnerIds = 0 OR c.owner_id IN $$ownerIds)
  ),
  years_of_relevance AS (
    SELECT cs.charge_id,
           array_agg(cs.year_of_relevance) AS years_of_relevance
    FROM accounter_schema.charge_spread cs
    JOIN filtered_charges fc ON fc.id = cs.charge_id
    GROUP BY cs.charge_id
  ),
  transactions_by_charge AS (
    SELECT t.charge_id,
           min(t.event_date) AS min_event_date,
           max(t.event_date) AS max_event_date,
           min(COALESCE(t.debit_date_override, t.debit_date)) AS min_debit_date,
           max(COALESCE(t.debit_date_override, t.debit_date)) AS max_debit_date,
           sum(t.amount) AS event_amount,
           count(*) AS transactions_count,
           count(*) FILTER (
             WHERE t.business_id IS NULL
             OR COALESCE(t.debit_date_override, t.debit_date) IS NULL
           ) > 0 AS invalid_transactions,
           array_agg(DISTINCT t.currency) AS currency_array,
           string_agg(COALESCE(t.source_description, '') || ' ' || COALESCE(t.source_reference, ''), ' ') AS search_text
    FROM accounter_schema.transactions t
    JOIN filtered_charges fc ON fc.id = t.charge_id
    GROUP BY t.charge_id
  ),
  documents_by_charge AS (
    SELECT d.charge_id,
           min(d.date) FILTER (
             WHERE d.type = ANY (
               ARRAY[
                 'INVOICE'::accounter_schema.document_type,
                 'INVOICE_RECEIPT'::accounter_schema.document_type,
                 'RECEIPT'::accounter_schema.document_type,
                 'CREDIT_INVOICE'::accounter_schema.document_type
               ]
             )
           ) AS min_event_date,
           min(d.date) AS min_any_event_date,
           max(d.date) FILTER (
             WHERE d.type = ANY (
               ARRAY[
                 'INVOICE'::accounter_schema.document_type,
                 'INVOICE_RECEIPT'::accounter_schema.document_type,
                 'RECEIPT'::accounter_schema.document_type,
                 'CREDIT_INVOICE'::accounter_schema.document_type
               ]
             )
           ) AS max_event_date,
           max(d.date) AS max_any_event_date,
           sum(
             d.total_amount *
             CASE
               WHEN d.creditor_id = fc.owner_id THEN 1
               ELSE '-1'::integer
             END::double precision
           ) FILTER (
             WHERE businesses.can_settle_with_receipt = true
               AND d.type = ANY (
                 ARRAY[
                   'RECEIPT'::accounter_schema.document_type,
                   'INVOICE_RECEIPT'::accounter_schema.document_type
                 ]
               )
           ) AS receipt_event_amount,
           sum(
             d.total_amount *
             CASE
               WHEN d.creditor_id = fc.owner_id THEN 1
               ELSE '-1'::integer
             END::double precision
           ) FILTER (
             WHERE d.type = ANY (
               ARRAY[
                 'INVOICE'::accounter_schema.document_type,
                 'INVOICE_RECEIPT'::accounter_schema.document_type,
                 'CREDIT_INVOICE'::accounter_schema.document_type
               ]
             )
           ) AS invoice_event_amount,
           sum(
             d.vat_amount *
             CASE
               WHEN d.creditor_id = fc.owner_id THEN 1
               ELSE '-1'::integer
             END::double precision
           ) FILTER (
             WHERE businesses.can_settle_with_receipt = true
               AND d.type = ANY (
                 ARRAY[
                   'RECEIPT'::accounter_schema.document_type,
                   'INVOICE_RECEIPT'::accounter_schema.document_type
                 ]
               )
           ) AS receipt_vat_amount,
           sum(
             d.vat_amount *
             CASE
               WHEN d.creditor_id = fc.owner_id THEN 1
               ELSE '-1'::integer
             END::double precision
           ) FILTER (
             WHERE d.type = ANY (
               ARRAY[
                 'INVOICE'::accounter_schema.document_type,
                 'INVOICE_RECEIPT'::accounter_schema.document_type,
                 'CREDIT_INVOICE'::accounter_schema.document_type
               ]
             )
           ) AS invoice_vat_amount,
           count(*) FILTER (
             WHERE d.type = ANY (
               ARRAY[
                 'INVOICE'::accounter_schema.document_type,
                 'INVOICE_RECEIPT'::accounter_schema.document_type,
                 'CREDIT_INVOICE'::accounter_schema.document_type
               ]
             )
           ) AS invoices_count,
           count(*) FILTER (
             WHERE d.type = ANY (
               ARRAY[
                 'RECEIPT'::accounter_schema.document_type,
                 'INVOICE_RECEIPT'::accounter_schema.document_type
               ]
             )
           ) AS receipts_count,
           count(*) AS documents_count,
           count(*) FILTER (
             WHERE (
               d.type = ANY (
                 ARRAY[
                   'INVOICE'::accounter_schema.document_type,
                   'INVOICE_RECEIPT'::accounter_schema.document_type,
                   'RECEIPT'::accounter_schema.document_type,
                   'CREDIT_INVOICE'::accounter_schema.document_type
                 ]
               )
             )
             AND (
               d.debtor_id IS NULL
               OR d.creditor_id IS NULL
               OR d.date IS NULL
               OR d.serial_number IS NULL
               OR d.vat_amount IS NULL
               OR d.total_amount IS NULL
               OR d.charge_id IS NULL
               OR d.currency_code IS NULL
             )
             OR d.type = 'UNPROCESSED'::accounter_schema.document_type
           ) > 0 AS invalid_documents,
           array_agg(d.currency_code) FILTER (
             WHERE (
               businesses.can_settle_with_receipt = true
               AND d.type = ANY (
                 ARRAY[
                   'RECEIPT'::accounter_schema.document_type,
                   'INVOICE_RECEIPT'::accounter_schema.document_type
                 ]
               )
             )
             OR d.type = ANY (
               ARRAY[
                 'INVOICE'::accounter_schema.document_type,
                 'INVOICE_RECEIPT'::accounter_schema.document_type,
                 'CREDIT_INVOICE'::accounter_schema.document_type
               ]
             )
           ) AS currency_array,
           COALESCE(BOOL_OR(doc_issued.status = 'OPEN'), false) AS open_docs_flag,
           string_agg(COALESCE(d.description, '') || ' ' || COALESCE(d.remarks, '') || ' ' || COALESCE(d.serial_number, ''), ' ') AS search_text
    FROM accounter_schema.documents d
    JOIN filtered_charges fc ON fc.id = d.charge_id
    LEFT JOIN accounter_schema.businesses
      ON (
        d.creditor_id = fc.owner_id
        AND d.debtor_id = businesses.id
      )
      OR (
        d.creditor_id = businesses.id
        AND d.debtor_id = fc.owner_id
      )
    LEFT JOIN accounter_schema.documents_issued doc_issued ON d.id = doc_issued.id
    GROUP BY d.charge_id
  ),
  businesses_by_charge AS (
    SELECT base.charge_id,
           array_remove(base.business_array, fc.owner_id) AS business_array,
           array_remove(base.filtered_business_array, fc.owner_id) AS filtered_business_array
    FROM (
      SELECT b.charge_id,
             array_agg(DISTINCT b.business_id) AS business_array,
             array_remove(
               array_agg(
                 DISTINCT CASE
                   WHEN b.is_fee THEN NULL::uuid
                   ELSE b.business_id
                 END
               ),
               NULL::uuid
             ) AS filtered_business_array
      FROM (
        SELECT t.charge_id, t.business_id, t.is_fee
        FROM accounter_schema.transactions t
        JOIN filtered_charges fc ON fc.id = t.charge_id
        WHERE t.business_id IS NOT NULL

        UNION
        SELECT d.charge_id, d.creditor_id, false AS is_fee
        FROM accounter_schema.documents d
        JOIN filtered_charges fc ON fc.id = d.charge_id
        WHERE d.creditor_id IS NOT NULL

        UNION
        SELECT d.charge_id, d.debtor_id, false AS is_fee
        FROM accounter_schema.documents d
        JOIN filtered_charges fc ON fc.id = d.charge_id
        WHERE d.debtor_id IS NOT NULL

        UNION
        SELECT lr.charge_id, lr.credit_entity1, true AS is_fee
        FROM accounter_schema.ledger_records lr
        JOIN filtered_charges fc ON fc.id = lr.charge_id
        WHERE lr.credit_entity1 IS NOT NULL

        UNION
        SELECT lr.charge_id, lr.credit_entity2, true AS is_fee
        FROM accounter_schema.ledger_records lr
        JOIN filtered_charges fc ON fc.id = lr.charge_id
        WHERE lr.credit_entity2 IS NOT NULL

        UNION
        SELECT lr.charge_id, lr.debit_entity1, true AS is_fee
        FROM accounter_schema.ledger_records lr
        JOIN filtered_charges fc ON fc.id = lr.charge_id
        WHERE lr.debit_entity1 IS NOT NULL

        UNION
        SELECT lr.charge_id, lr.debit_entity2, true AS is_fee
        FROM accounter_schema.ledger_records lr
        JOIN filtered_charges fc ON fc.id = lr.charge_id
        WHERE lr.debit_entity2 IS NOT NULL
      ) b
      GROUP BY b.charge_id
    ) base
    JOIN filtered_charges fc ON fc.id = base.charge_id
  ),
  tags_by_charge AS (
    SELECT ct.charge_id,
           array_agg(ct.tag_id) AS tags_array
    FROM accounter_schema.charge_tags ct
    JOIN filtered_charges fc ON fc.id = ct.charge_id
    GROUP BY ct.charge_id
  ),
  ledger_by_charge AS (
    SELECT count(DISTINCT x.id) AS ledger_count,
           array_remove(array_agg(DISTINCT x.financial_entity), NULL::uuid) AS ledger_financial_entities,
           min(x.value_date) AS min_value_date,
           max(x.value_date) AS max_value_date,
           min(x.invoice_date) AS min_invoice_date,
           max(x.invoice_date) AS max_invoice_date,
           x.charge_id
    FROM (
      SELECT lr.charge_id,
             lr.id,
             lr.value_date,
             lr.invoice_date,
             unnest(
               ARRAY[
                 lr.credit_entity1,
                 lr.credit_entity2,
                 lr.debit_entity1,
                 lr.debit_entity2
               ]
             ) AS financial_entity
      FROM accounter_schema.ledger_records lr
      JOIN filtered_charges fc ON fc.id = lr.charge_id
    ) x
    GROUP BY x.charge_id
  ),
  enriched_charges AS (
    SELECT
      c.id,
      c.owner_id,
      d.id IS NOT NULL AS is_property,
      c.accountant_status,
      c.user_description,
      c.created_at,
      c.updated_at,
      COALESCE(c.tax_category_id, tcm.tax_category_id) AS tax_category_id,
      COALESCE(dbc.invoice_event_amount::numeric, dbc.receipt_event_amount::numeric, tbc.event_amount) AS event_amount,
      tbc.min_event_date AS transactions_min_event_date,
      tbc.max_event_date AS transactions_max_event_date,
      tbc.min_debit_date AS transactions_min_debit_date,
      tbc.max_debit_date AS transactions_max_debit_date,
      tbc.event_amount AS transactions_event_amount,
      CASE
        WHEN array_length(tbc.currency_array, 1) = 1 THEN tbc.currency_array[1]
        ELSE NULL::accounter_schema.currency
      END AS transactions_currency,
      tbc.transactions_count,
      tbc.invalid_transactions,
      COALESCE(dbc.min_event_date, dbc.min_any_event_date) AS documents_min_date,
      COALESCE(dbc.max_event_date, dbc.max_any_event_date) AS documents_max_date,
      COALESCE(dbc.invoice_event_amount, dbc.receipt_event_amount) AS documents_event_amount,
      COALESCE(dbc.invoice_vat_amount, dbc.receipt_vat_amount) AS documents_vat_amount,
      CASE
        WHEN array_length(dbc.currency_array, 1) = 1 THEN dbc.currency_array[1]
        ELSE NULL::accounter_schema.currency
      END AS documents_currency,
      dbc.invoices_count,
      dbc.receipts_count,
      dbc.documents_count,
      dbc.invalid_documents,
      dbc.open_docs_flag,
      bbc.business_array,
      b.id AS business_id,
      COALESCE(b.can_settle_with_receipt, false) AS can_settle_with_receipt,
      tgc.tags_array AS tags,
      btc.business_trip_id,
      lbc.ledger_count,
      lbc.ledger_financial_entities,
      lbc.min_value_date AS ledger_min_value_date,
      lbc.max_value_date AS ledger_max_value_date,
      lbc.min_invoice_date AS ledger_min_invoice_date,
      lbc.max_invoice_date AS ledger_max_invoice_date,
      y.years_of_relevance,
      c.invoice_payment_currency_diff,
      c.type,
      c.optional_vat,
      COALESCE(b.no_invoices_required, false) AS no_invoices_required,
      c.documents_optional_flag,
      LOWER(
        CONCAT_WS(
          ' ',
          c.user_description,
          tbc.search_text,
          dbc.search_text
        )
      ) AS merged_search_text
    FROM filtered_charges c
    LEFT JOIN transactions_by_charge tbc ON tbc.charge_id = c.id
    LEFT JOIN documents_by_charge dbc ON dbc.charge_id = c.id
    LEFT JOIN businesses_by_charge bbc ON bbc.charge_id = c.id
    LEFT JOIN accounter_schema.businesses b
      ON b.id = bbc.filtered_business_array[1]
      AND array_length(bbc.filtered_business_array, 1) = 1
    LEFT JOIN accounter_schema.business_tax_category_match tcm
      ON tcm.business_id = b.id
      AND tcm.owner_id = c.owner_id
    LEFT JOIN tags_by_charge tgc ON tgc.charge_id = c.id
    LEFT JOIN accounter_schema.business_trip_charges btc ON btc.charge_id = c.id
    LEFT JOIN ledger_by_charge lbc ON lbc.charge_id = c.id
    LEFT JOIN years_of_relevance y ON y.charge_id = c.id
    LEFT JOIN accounter_schema.depreciation d ON d.charge_id = c.id
  )
  SELECT
    ec.*,
    ABS(ec.event_amount) as abs_event_amount
  FROM enriched_charges ec
  WHERE
  ($isBusinessIds = 0 OR ec.business_array && $businessIds)
  AND ($fromDate ::TEXT IS NULL OR COALESCE(ec.documents_min_date, ec.transactions_min_event_date)::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
  AND ($fromAnyDate ::TEXT IS NULL OR GREATEST(ec.documents_max_date, ec.transactions_max_event_date, ec.transactions_max_debit_date, ec.ledger_max_invoice_date, ec.ledger_max_value_date)::TEXT::DATE >= date_trunc('day', $fromAnyDate ::DATE))
  AND ($toDate ::TEXT IS NULL OR COALESCE(ec.documents_max_date, ec.transactions_max_event_date)::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
  AND ($toAnyDate ::TEXT IS NULL OR LEAST(ec.documents_min_date, ec.transactions_min_event_date, ec.transactions_min_debit_date, ec.ledger_min_invoice_date, ec.ledger_min_value_date)::TEXT::DATE <= date_trunc('day', $toAnyDate ::DATE))
  AND ($chargeType = 'ALL' OR ($chargeType = 'INCOME' AND ec.transactions_event_amount > 0) OR ($chargeType = 'EXPENSE' AND ec.transactions_event_amount <= 0))
  AND ($type::accounter_schema.charge_type IS NULL OR ec.type = $type)
  AND ($withoutInvoice = FALSE OR COALESCE(ec.invoices_count, 0) = 0)
  AND ($withoutReceipt = FALSE OR (COALESCE(ec.receipts_count, 0) = 0 AND (ec.no_invoices_required IS FALSE)))
  AND ($withoutDocuments = FALSE OR COALESCE(ec.documents_count, 0) = 0)
  AND ($withoutTransactions = FALSE OR COALESCE(ec.transactions_count, 0) = 0)
  AND ($withOpenDocuments = FALSE OR ec.open_docs_flag IS TRUE)
  AND ($withoutLedger = FALSE OR COALESCE(ec.ledger_count, 0) = 0)
  AND ($isAccountantStatuses = 0 OR ec.accountant_status = ANY ($accountantStatuses::accounter_schema.accountant_status[]))
  AND ($isTags = 0 OR ec.tags && $tags)
  ORDER BY
  CASE WHEN $asc = true AND $sortColumn = 'event_date' THEN (COALESCE(ec.transactions_min_debit_date, ec.transactions_min_event_date, ec.documents_min_date, ec.ledger_min_value_date, ec.ledger_min_invoice_date), COALESCE(ec.documents_min_date, ec.transactions_min_event_date), ec.id) END ASC,
  CASE WHEN $asc = false AND $sortColumn = 'event_date' THEN (COALESCE(ec.transactions_min_debit_date, ec.transactions_min_event_date, ec.documents_min_date, ec.ledger_min_value_date, ec.ledger_min_invoice_date), COALESCE(ec.documents_min_date, ec.transactions_min_event_date), ec.id) END DESC,
  CASE WHEN $asc = true AND $sortColumn = 'event_amount' THEN (ec.event_amount, ec.id) END ASC,
  CASE WHEN $asc = false AND $sortColumn = 'event_amount' THEN (ec.event_amount, ec.id) END DESC,
  CASE WHEN $asc = true AND $sortColumn = 'abs_event_amount' THEN ABS(cast(ec.event_amount as DECIMAL)) END ASC,
  CASE WHEN $asc = false AND $sortColumn = 'abs_event_amount' THEN ABS(cast(ec.event_amount as DECIMAL)) END DESC,
  ec.id;
  `;

const getSimilarCharges = sql<IGetSimilarChargesQuery>`
      WITH owner_charges AS (
        SELECT c.*
        FROM accounter_schema.charges c
        WHERE c.owner_id = $ownerId
      ),
      transactions_by_charge AS (
        SELECT t.charge_id,
               min(t.event_date) AS min_event_date,
               max(t.event_date) AS max_event_date,
               min(COALESCE(t.debit_date_override, t.debit_date)) AS min_debit_date,
               max(COALESCE(t.debit_date_override, t.debit_date)) AS max_debit_date,
               sum(t.amount) AS event_amount,
               count(*) AS transactions_count,
               count(*) FILTER (
                 WHERE t.business_id IS NULL
                 OR COALESCE(t.debit_date_override, t.debit_date) IS NULL
               ) > 0 AS invalid_transactions,
               array_agg(DISTINCT t.currency) AS currency_array
        FROM accounter_schema.transactions t
        JOIN owner_charges oc ON oc.id = t.charge_id
        GROUP BY t.charge_id
      ),
      documents_by_charge AS (
        SELECT d.charge_id,
               min(d.date) FILTER (
                 WHERE d.type = ANY (
                   ARRAY[
                     'INVOICE'::accounter_schema.document_type,
                     'INVOICE_RECEIPT'::accounter_schema.document_type,
                     'RECEIPT'::accounter_schema.document_type,
                     'CREDIT_INVOICE'::accounter_schema.document_type
                   ]
                 )
               ) AS min_event_date,
               min(d.date) AS min_any_event_date,
               max(d.date) FILTER (
                 WHERE d.type = ANY (
                   ARRAY[
                     'INVOICE'::accounter_schema.document_type,
                     'INVOICE_RECEIPT'::accounter_schema.document_type,
                     'RECEIPT'::accounter_schema.document_type,
                     'CREDIT_INVOICE'::accounter_schema.document_type
                   ]
                 )
               ) AS max_event_date,
               max(d.date) AS max_any_event_date,
               sum(
                 d.total_amount *
                 CASE
                   WHEN d.creditor_id = oc.owner_id THEN 1
                   ELSE '-1'::integer
                 END::double precision
               ) FILTER (
                 WHERE businesses.can_settle_with_receipt = true
                 AND (
                   d.type = ANY (
                     ARRAY[
                       'RECEIPT'::accounter_schema.document_type,
                       'INVOICE_RECEIPT'::accounter_schema.document_type
                     ]
                   )
                 )
               ) AS receipt_event_amount,
               sum(
                 d.total_amount *
                 CASE
                   WHEN d.creditor_id = oc.owner_id THEN 1
                   ELSE '-1'::integer
                 END::double precision
               ) FILTER (
                 WHERE d.type = ANY (
                   ARRAY[
                     'INVOICE'::accounter_schema.document_type,
                     'INVOICE_RECEIPT'::accounter_schema.document_type,
                     'CREDIT_INVOICE'::accounter_schema.document_type
                   ]
                 )
               ) AS invoice_event_amount,
               sum(
                 d.vat_amount *
                 CASE
                   WHEN d.creditor_id = oc.owner_id THEN 1
                   ELSE '-1'::integer
                 END::double precision
               ) FILTER (
                 WHERE businesses.can_settle_with_receipt = true
                 AND (
                   d.type = ANY (
                     ARRAY[
                       'RECEIPT'::accounter_schema.document_type,
                       'INVOICE_RECEIPT'::accounter_schema.document_type
                     ]
                   )
                 )
               ) AS receipt_vat_amount,
               sum(
                 d.vat_amount *
                 CASE
                   WHEN d.creditor_id = oc.owner_id THEN 1
                   ELSE '-1'::integer
                 END::double precision
               ) FILTER (
                 WHERE d.type = ANY (
                   ARRAY[
                     'INVOICE'::accounter_schema.document_type,
                     'INVOICE_RECEIPT'::accounter_schema.document_type,
                     'CREDIT_INVOICE'::accounter_schema.document_type
                   ]
                 )
               ) AS invoice_vat_amount,
               count(*) FILTER (
                 WHERE d.type = ANY (
                   ARRAY[
                     'INVOICE'::accounter_schema.document_type,
                     'INVOICE_RECEIPT'::accounter_schema.document_type,
                     'CREDIT_INVOICE'::accounter_schema.document_type
                   ]
                 )
               ) AS invoices_count,
               count(*) FILTER (
                 WHERE d.type = ANY (
                   ARRAY[
                     'RECEIPT'::accounter_schema.document_type,
                     'INVOICE_RECEIPT'::accounter_schema.document_type
                   ]
                 )
               ) AS receipts_count,
               count(*) AS documents_count,
               count(*) FILTER (
                 WHERE (
                   d.type = ANY (
                     ARRAY[
                       'INVOICE'::accounter_schema.document_type,
                       'INVOICE_RECEIPT'::accounter_schema.document_type,
                       'RECEIPT'::accounter_schema.document_type,
                       'CREDIT_INVOICE'::accounter_schema.document_type
                     ]
                   )
                 )
                 AND (
                   d.debtor_id IS NULL
                   OR d.creditor_id IS NULL
                   OR d.date IS NULL
                   OR d.serial_number IS NULL
                   OR d.vat_amount IS NULL
                   OR d.total_amount IS NULL
                   OR d.charge_id IS NULL
                   OR d.currency_code IS NULL
                 )
                 OR d.type = 'UNPROCESSED'::accounter_schema.document_type
               ) > 0 AS invalid_documents,
               array_agg(d.currency_code) FILTER (
                 WHERE (
                   businesses.can_settle_with_receipt = true
                   AND d.type = ANY (
                     ARRAY[
                       'RECEIPT'::accounter_schema.document_type,
                       'INVOICE_RECEIPT'::accounter_schema.document_type
                     ]
                   )
                 )
                 OR d.type = ANY (
                   ARRAY[
                     'INVOICE'::accounter_schema.document_type,
                     'INVOICE_RECEIPT'::accounter_schema.document_type,
                     'CREDIT_INVOICE'::accounter_schema.document_type
                   ]
                 )
               ) AS currency_array,
               COALESCE(BOOL_OR(doc_issued.status = 'OPEN'), false) AS open_docs_flag
        FROM accounter_schema.documents d
        JOIN owner_charges oc ON oc.id = d.charge_id
        LEFT JOIN accounter_schema.businesses
          ON (
            d.creditor_id = oc.owner_id
            AND d.debtor_id = businesses.id
          )
          OR (
            d.creditor_id = businesses.id
            AND d.debtor_id = oc.owner_id
          )
        LEFT JOIN accounter_schema.documents_issued doc_issued ON d.id = doc_issued.id
        GROUP BY d.charge_id
      ),
      businesses_by_charge AS (
        SELECT base.charge_id,
               array_remove(base.business_array, oc.owner_id) AS business_array,
               array_remove(base.filtered_business_array, oc.owner_id) AS filtered_business_array
        FROM (
          SELECT b.charge_id,
                 array_agg(DISTINCT b.business_id) AS business_array,
                 array_remove(
                   array_agg(
                     DISTINCT CASE
                       WHEN b.is_fee THEN NULL::uuid
                       ELSE b.business_id
                     END
                   ),
                   NULL::uuid
                 ) AS filtered_business_array
          FROM (
            SELECT t.charge_id, t.business_id, t.is_fee
            FROM accounter_schema.transactions t
            JOIN owner_charges oc ON oc.id = t.charge_id
            WHERE t.business_id IS NOT NULL

            UNION

            SELECT d.charge_id, d.creditor_id, false AS is_fee
            FROM accounter_schema.documents d
            JOIN owner_charges oc ON oc.id = d.charge_id
            WHERE d.creditor_id IS NOT NULL

            UNION

            SELECT d.charge_id, d.debtor_id, false AS is_fee
            FROM accounter_schema.documents d
            JOIN owner_charges oc ON oc.id = d.charge_id
            WHERE d.debtor_id IS NOT NULL

            UNION

            SELECT lr.charge_id, lr.credit_entity1, true AS is_fee
            FROM accounter_schema.ledger_records lr
            JOIN owner_charges oc ON oc.id = lr.charge_id
            WHERE lr.credit_entity1 IS NOT NULL

            UNION

            SELECT lr.charge_id, lr.credit_entity2, true AS is_fee
            FROM accounter_schema.ledger_records lr
            JOIN owner_charges oc ON oc.id = lr.charge_id
            WHERE lr.credit_entity2 IS NOT NULL

            UNION

            SELECT lr.charge_id, lr.debit_entity1, true AS is_fee
            FROM accounter_schema.ledger_records lr
            JOIN owner_charges oc ON oc.id = lr.charge_id
            WHERE lr.debit_entity1 IS NOT NULL

            UNION

            SELECT lr.charge_id, lr.debit_entity2, true AS is_fee
            FROM accounter_schema.ledger_records lr
            JOIN owner_charges oc ON oc.id = lr.charge_id
            WHERE lr.debit_entity2 IS NOT NULL
          ) b
          GROUP BY b.charge_id
        ) base
        JOIN owner_charges oc ON oc.id = base.charge_id
      ),
      tags_by_charge AS (
        SELECT ct.charge_id,
               array_agg(ct.tag_id) AS tags_array
        FROM accounter_schema.charge_tags ct
        JOIN owner_charges oc ON oc.id = ct.charge_id
        GROUP BY ct.charge_id
      ),
      ledger_by_charge AS (
        SELECT count(DISTINCT x.id) AS ledger_count,
               array_remove(array_agg(DISTINCT x.financial_entity), NULL::uuid) AS ledger_financial_entities,
               min(x.value_date) AS min_value_date,
               max(x.value_date) AS max_value_date,
               min(x.invoice_date) AS min_invoice_date,
               max(x.invoice_date) AS max_invoice_date,
               x.charge_id
        FROM (
          SELECT lr.charge_id,
                 lr.id,
                 lr.value_date,
                 lr.invoice_date,
                 unnest(
                   ARRAY[
                     lr.credit_entity1,
                     lr.credit_entity2,
                     lr.debit_entity1,
                     lr.debit_entity2
                   ]
                 ) AS financial_entity
          FROM accounter_schema.ledger_records lr
          JOIN owner_charges oc ON oc.id = lr.charge_id
        ) x
        GROUP BY x.charge_id
      )
      SELECT
        c.*
      FROM owner_charges c
      LEFT JOIN transactions_by_charge tbc ON tbc.charge_id = c.id
      LEFT JOIN documents_by_charge dbc ON dbc.charge_id = c.id
      LEFT JOIN businesses_by_charge bbc ON bbc.charge_id = c.id
      LEFT JOIN accounter_schema.businesses b
        ON b.id = bbc.filtered_business_array[1]
        AND array_length(bbc.filtered_business_array, 1) = 1
      LEFT JOIN tags_by_charge tgc ON tgc.charge_id = c.id
      LEFT JOIN ledger_by_charge lbc ON lbc.charge_id = c.id
      WHERE ($withMissingTags IS NOT TRUE OR tgc.tags_array IS NULL)
        AND ($withMissingDescription IS NOT TRUE OR c.user_description IS NULL)
        AND (
          $tagsDifferentThan::UUID[] IS NULL
          OR NOT ((tgc.tags_array @> $tagsDifferentThan) AND (tgc.tags_array <@ $tagsDifferentThan))
        )
        AND (
          $descriptionDifferentThan::TEXT IS NULL
          OR c.user_description IS DISTINCT FROM $descriptionDifferentThan
        )
        AND (
          (b.id IS NOT NULL AND b.id = $businessId)
          OR (
            bbc.business_array IS NOT NULL
            AND bbc.business_array @> $businessArray
            AND bbc.business_array <@ $businessArray
          )
        )
      ORDER BY (
        COALESCE(
          COALESCE(dbc.min_event_date, dbc.min_any_event_date),
          tbc.min_debit_date,
          tbc.min_event_date,
          lbc.min_value_date,
          lbc.min_invoice_date
        ),
        COALESCE(tbc.min_event_date, COALESCE(dbc.min_event_date, dbc.min_any_event_date)),
        c.id
      ) DESC;`;

type IGetAdjustedChargesByFiltersParams = Optional<
  Omit<
    IGetChargesByFiltersParams,
    'isOwnerIds' | 'isBusinessIds' | 'businessIds' | 'isIDs' | 'isTags' | 'tags'
  >,
  'ownerIds' | 'IDs' | 'asc' | 'sortColumn' | 'toDate' | 'fromDate'
> & {
  toDate?: TimelessDateString | null;
  fromDate?: TimelessDateString | null;
  tags?: readonly string[] | null;
  businessIds?: readonly string[] | null;
};

const deleteChargesByIds = sql<IDeleteChargesByIdsQuery>`
    DELETE FROM accounter_schema.charges
    WHERE id IN $$chargeIds;`;
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class ChargesProvider {
  constructor(
    private db: TenantAwareDBClient,
    private auth: ChargesAuthorizationProvider,
  ) {}

  private async batchChargesByIds(ids: readonly string[]) {
    const charges = await getChargesByIds.run(
      {
        chargeIds: ids,
      },
      this.db,
    );
    return ids.map(id => charges.find(charge => charge.id === id));
  }

  public getChargeByIdLoader = new DataLoader((keys: readonly string[]) =>
    this.batchChargesByIds(keys),
  );

  private async batchChargesByTransactionIds(transactionIds: readonly string[]) {
    const charges = await getChargesByTransactionIds.run(
      {
        transactionIds,
      },
      this.db,
    );
    charges.map(c => this.getChargeByIdLoader.prime(c.id, c));
    return transactionIds.map(id => charges.find(charge => charge.transaction_id === id));
  }

  public getChargeByTransactionIdLoader = new DataLoader(
    (transactionIds: readonly string[]) => this.batchChargesByTransactionIds(transactionIds),
    { cache: false },
  );

  public async getChargesByMissingRequiredInfo() {
    return getChargesByMissingRequiredInfo.run(undefined, this.db).then(charges =>
      charges.map(c => {
        this.getChargeByIdLoader.prime(c.id, c);
        return c;
      }),
    );
  }

  public async updateCharge(params: IUpdateChargeParams) {
    await this.auth.canWriteCharge();

    if (params.chargeId) {
      this.invalidateCharge(params.chargeId);
    }
    return updateCharge.run(params, this.db).then(([newCharge]) => {
      if (newCharge) {
        this.invalidateCharge(newCharge.id);
        this.getChargeByIdLoader.prime(newCharge.id, newCharge);
      }
      return newCharge;
    });
  }

  public async batchUpdateCharges(params: IBatchUpdateChargesParams) {
    await this.auth.canWriteCharge();

    params.chargeIds.map(chargeId => {
      if (chargeId) {
        this.invalidateCharge(chargeId);
      }
    });
    const charges = await batchUpdateCharges.run(params, this.db);
    charges.map(charge => this.getChargeByIdLoader.prime(charge.id, charge));
    return charges;
  }

  public async updateAccountantApproval(params: IUpdateAccountantApprovalParams) {
    await this.auth.canWriteCharge();

    const [newCharge] = await updateAccountantApproval.run(params, this.db);
    if (newCharge) {
      this.getChargeByIdLoader.prime(newCharge.id, newCharge);
    }
    return newCharge;
  }

  public async generateCharge(params: IGenerateChargeParams, dbConnection?: IDatabaseConnection) {
    await this.auth.canWriteCharge();

    const fullParams = {
      isProperty: false,
      userDescription: null,
      optionalVAT: false,
      optionalDocuments: false,
      accountantStatus: 'UNAPPROVED' as accountant_status,
      ...params,
    };
    const [newCharge] = await generateCharge.run(fullParams, dbConnection ?? this.db);
    if (newCharge) {
      this.getChargeByIdLoader.prime(newCharge.id, newCharge);
    }
    return newCharge;
  }

  public getChargesByFilters(params: IGetAdjustedChargesByFiltersParams) {
    const isOwnerIds = !!params?.ownerIds?.filter(Boolean).length;
    const isBusinessIds = !!params?.businessIds?.filter(Boolean).length;
    const isIDs = !!params?.IDs?.length;
    const isTags = !!params?.tags?.length;
    const isAccountantStatuses = !!params?.accountantStatuses?.length;

    const defaults = {
      asc: false,
      sortColumn: 'event_date',
    };

    const fullParams: IGetChargesByFiltersParams = {
      ...defaults,
      isOwnerIds: isOwnerIds ? 1 : 0,
      isBusinessIds: isBusinessIds ? 1 : 0,
      isIDs: isIDs ? 1 : 0,
      isTags: isTags ? 1 : 0,
      isAccountantStatuses: isAccountantStatuses ? 1 : 0,
      ...params,
      fromDate: params.fromDate ?? null,
      toDate: params.toDate ?? null,
      ownerIds: isOwnerIds ? params.ownerIds! : [null],
      businessIds: isBusinessIds ? (params.businessIds! as string[]) : null,
      IDs: isIDs ? params.IDs! : [null],
      tags: isTags ? (params.tags! as string[]) : null,
      chargeType: params.chargeType ?? 'ALL',
      withoutInvoice: params.withoutInvoice ?? false,
      withoutReceipt: params.withoutReceipt ?? false,
      withoutDocuments: params.withoutDocuments ?? false,
      withOpenDocuments: params.withOpenDocuments ?? false,
      withoutTransactions: params.withoutTransactions ?? false,
      withoutLedger: params.withoutLedger ?? false,
      accountantStatuses: isAccountantStatuses ? params.accountantStatuses! : null,
    };
    return getChargesByFilters.run(fullParams, this.db) as Promise<IGetChargesByFiltersResult[]>;
  }

  public async getSimilarCharges(params: IGetSimilarChargesParams) {
    try {
      return getSimilarCharges.run(params, this.db) as Promise<IGetChargesByFiltersResult[]>;
    } catch (error) {
      const message = 'Failed to fetch similar charges';
      console.error(message, error);
      throw new Error(message);
    }
  }

  public async deleteChargesByIds(params: IDeleteChargesByIdsParams) {
    const chargeIds = params.chargeIds.filter((chargeId): chargeId is string => !!chargeId);

    await this.auth.canDeleteChargesByIds(chargeIds);

    return deleteChargesByIds.run({ chargeIds }, this.db);
  }

  public async deleteCharge(chargeId: string) {
    return this.deleteChargesByIds({ chargeIds: [chargeId] });
  }

  public async invalidateCharge(chargeId: string) {
    this.getChargeByIdLoader.clear(chargeId);
  }

  public clearCache() {
    this.getChargeByIdLoader.clearAll();
  }
}
