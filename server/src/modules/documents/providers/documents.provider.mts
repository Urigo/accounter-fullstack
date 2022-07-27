import pgQuery from '@pgtyped/query';
import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { Pool } from 'pg';

import {
  IDeleteDocumentQuery,
  IGetAllDocumentsQuery,
  IGetDocumentsByChargeIdQuery,
  IGetDocumentsByFinancialEntityIdsQuery,
  IInsertDocumentsParams,
  IInsertDocumentsQuery,
  IUpdateDocumentParams,
  IUpdateDocumentQuery,
} from '../generated-types/documents.provider.types.mjs';

const { sql } = pgQuery;

const getAllDocuments = sql<IGetAllDocumentsQuery>`
  SELECT *
  FROM accounter_schema.documents
  ORDER BY created_at DESC;
`;

const getDocumentsByChargeId = sql<IGetDocumentsByChargeIdQuery>`
  SELECT *
  FROM accounter_schema.documents
  WHERE charge_id in $$chargeIds
  ORDER BY created_at DESC;
`;

const getDocumentsByFinancialEntityIds = sql<IGetDocumentsByFinancialEntityIdsQuery>`
  SELECT *
  FROM accounter_schema.documents
  WHERE charge_id IN(
    SELECT at.id as financial_entity_id
    FROM accounter_schema.all_transactions at
    LEFT JOIN accounter_schema.financial_accounts fa
    ON  at.account_number = fa.account_number
    WHERE fa.owner IN $$financialEntityIds
    )
  ORDER BY created_at DESC;
`;

const updateDocument = sql<IUpdateDocumentQuery>`
  UPDATE accounter_schema.documents
  SET
  charge_id = CASE
    WHEN $chargeId='NULL' THEN NULL
    ELSE COALESCE(
      $chargeId::UUID,
      charge_id,
      NULL
    ) END,
  currency_code = COALESCE(
    $currencyCode,
    currency_code,
    NULL
  ),
  date = COALESCE(
    $date,
    date,
    NULL
  ),
  file_url = COALESCE(
    $fileUrl,
    file_url,
    NULL
  ),
  id = COALESCE(
    id,
    id,
    NULL
  ),
  image_url = COALESCE(
    $imageUrl,
    image_url,
    NULL
  ),
  modified_at = NOW(),
  serial_number = COALESCE(
    $serialNumber,
    serial_number,
    NULL
  ),
  total_amount = COALESCE(
    $totalAmount,
    total_amount,
    NULL
  ),
  type = COALESCE(
    $type,
    type,
    NULL
  ),
  vat_amount = COALESCE(
    $vatAmount,
    vat_amount,
    NULL
  ),
  is_reviewed = COALESCE(
    $isReviewed,
    is_reviewed
  )
  WHERE
    id = $documentId
  RETURNING *;
`;

const deleteDocument = sql<IDeleteDocumentQuery>`
  DELETE FROM accounter_schema.documents
  WHERE id = $documentId
  RETURNING id;
`;

const insertDocuments = sql<IInsertDocumentsQuery>`
    INSERT INTO accounter_schema.documents (
      image_url,
      file_url,
      type,
      serial_number,
      date,
      total_amount,
      currency_code,
      vat_amount,
      charge_id
    )
    VALUES $$document(
      image,
      file,
      documentType,
      serialNumber,
      date,
      amount,
      currencyCode,
      vat,
      chargeId
    )
    RETURNING *;`;

@Injectable({
  scope: Scope.Singleton,
  global: false,
})
export class DocumentsProvider {
  constructor(private pool: Pool) {}

  private batchDocumentsByChargeIds = async (chargeIds: readonly string[]) => {
    const docs = await getDocumentsByChargeId.run({ chargeIds }, this.pool);

    return chargeIds.map(id => docs.filter(doc => doc.charge_id === id));
  };

  public getDocumentsByChargeIdLoader = new DataLoader(this.batchDocumentsByChargeIds, { cache: false });

  public insertDocuments = async (newDocuments: IInsertDocumentsParams['document']) => {
    return await insertDocuments.run({ document: newDocuments }, this.pool);
  };

  public updateDocument = async (adjustedFields: IUpdateDocumentParams) => {
    return await updateDocument.run({ ...adjustedFields }, this.pool);
  };

  public getDocumentsByFinancialEntityIds = async (financialEntityIds: string[]) => {
    return await getDocumentsByFinancialEntityIds.run({ financialEntityIds }, this.pool);
  };

  public deleteDocument = async (documentId: string) => {
    return await deleteDocument.run({ documentId }, this.pool);
  };

  public getAllDocuments = async () => {
    return await getAllDocuments.run(undefined, this.pool);
  };
}
