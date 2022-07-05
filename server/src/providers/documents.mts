import pgQuery from '@pgtyped/query';
import DataLoader from 'dataloader';

import {
  IGetAllDocumentsQuery,
  IGetDocumentsByChargeIdQuery,
  IGetDocumentsByFinancialEntityIdsQuery,
  IUpdateDocumentQuery,
} from '../__generated__/documents.types.mjs';
import { pool } from '../providers/db.mjs';

const { sql } = pgQuery;

export const getAllDocuments = sql<IGetAllDocumentsQuery>`
    SELECT *
    FROM accounter_schema.documents
    ORDER BY created_at DESC;`;

const getDocumentsByChargeId = sql<IGetDocumentsByChargeIdQuery>`
        SELECT *
        FROM accounter_schema.documents
        WHERE charge_id in $$chargeIds
        ORDER BY created_at DESC;`;

async function batchDocumentsByChargeIds(chargeIds: readonly string[]) {
  const docs = await getDocumentsByChargeId.run({ chargeIds }, pool);

  return chargeIds.map(id => docs.filter(doc => doc.charge_id === id));
}

export const getDocumentsByChargeIdLoader = new DataLoader(batchDocumentsByChargeIds, { cache: false });

export const getDocumentsByFinancialEntityIds = sql<IGetDocumentsByFinancialEntityIdsQuery>`
        SELECT *
        FROM accounter_schema.documents
        WHERE charge_id IN(
          SELECT at.id as financial_entity_id
          FROM accounter_schema.all_transactions at
          LEFT JOIN accounter_schema.financial_accounts fa
          ON  at.account_number = fa.account_number
          WHERE fa.owner IN $$financialEntityIds
          )
        ORDER BY created_at DESC;`;

export const updateDocument = sql<IUpdateDocumentQuery>`
        UPDATE accounter_schema.email_invoices
        SET
        email_subject = COALESCE(
          $emailSubject,
          email_subject,
          NULL
        ),
        email_received_date = COALESCE(
          $emailReceivedDate,
          email_received_date,
          NULL
        ),
        email_sender = COALESCE(
          $emailSender,
          email_sender,
          NULL
        ),
        email_id = COALESCE(
          $emailId,
          email_id,
          NULL
        ),
        image_url = COALESCE(
          $imageUrl,
          image_url,
          NULL
        ),
        payper_document_id = COALESCE(
          $payperDocumentId,
          payper_document_id,
          NULL
        ),
        payper_total_for_payment = COALESCE(
          $payperTotalForPayment,
          payper_total_for_payment,
          NULL
        ),
        payper_document_date = COALESCE(
          $payperDocumentDate,
          payper_document_date,
          NULL
        ),
        payper_vat_paytment = COALESCE(
          $payperVatPaytment,
          payper_vat_paytment,
          NULL
        ),
        payper_id = COALESCE(
          $payperId,
          payper_id,
          NULL
        ),
        transaction_id = COALESCE(
          $transactionId,
          transaction_id,
          NULL
        ),
        payper_provider = COALESCE(
          $payperProvider,
          payper_provider,
          NULL
        ),
        uri_comments = COALESCE(
          $uriComments,
          uri_comments,
          NULL
        ),
        payper_updated_at = COALESCE(
          $payperUpdatedAt,
          payper_updated_at,
          NULL
        ),
        email_to_payper_forward_date = COALESCE(
          $emailToPayperForwardDate,
          email_to_payper_forward_date,
          NULL
        ),
        payper_updated_flag = COALESCE(
          $payperUpdatedFlag,
          payper_updated_flag,
          NULL
        ),
        payper_currency_symbol = COALESCE(
          $payperCurrencySymbol,
          payper_currency_symbol,
          NULL
        ),
        duplication_of = COALESCE(
          $duplicationOf,
          duplication_of,
          NULL
        ),
        file_hash = COALESCE(
          $fileHash,
          file_hash,
          NULL
        ),
        payper_document_type = COALESCE(
          $payperDocumentType,
          payper_document_type,
          NULL
        ),
        payper_provider_id = COALESCE(
          $payperProviderId,
          payper_provider_id,
          NULL
        )
        WHERE
          id = $documentId
        RETURNING *;
      `;
