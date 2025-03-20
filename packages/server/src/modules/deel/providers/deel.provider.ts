import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { dateToTimelessDateString, getCacheInstance } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
import type {
  IGetDocumentRecordsByInvoiceDatesQuery,
  IGetDocumentRecordsByPaymentDatesQuery,
  IInsertDeelDocumentRecordsParams,
  IInsertDeelDocumentRecordsQuery,
  IUpdateDocumentRecordParams,
  IUpdateDocumentRecordQuery,
} from '../types.js';

const getDocumentRecordsByPaymentDates = sql<IGetDocumentRecordsByPaymentDatesQuery>`
  SELECT *
  FROM accounter_schema.deel_documents
  WHERE payed_date in $$paymentDates;`;

const getDocumentRecordsByInvoiceDates = sql<IGetDocumentRecordsByInvoiceDatesQuery>`
  SELECT *
  FROM accounter_schema.deel_documents
  WHERE invoice_date in $$invoiceDates;`;

const updateDocumentRecord = sql<IUpdateDocumentRecordQuery>`
  UPDATE accounter_schema.deel_documents
  SET document_id = COALESCE(
    $documentId,
    document_id
  ),
  deel_worker_id = COALESCE(
    $deelWorkerId,
    deel_worker_id
  ),
  worker_name = COALESCE(
    $workerName,
    worker_name
  ),
  entity = COALESCE(
    $entity,
    entity
  ),
  contract_id = COALESCE(
    $contractId,
    contract_id
  ),
  contract_or_fee_description = COALESCE(
    $contractOrFeeDescription,
    contract_or_fee_description
  )
  WHERE
    id = $recordId
  RETURNING *;`;

const insertDeelDocumentRecords = sql<IInsertDeelDocumentRecordsQuery>`
      INSERT INTO accounter_schema.deel_documents (
        amount,
        amount_invoice_currency,
        contract_id,
        contract_or_fee_description,
        currency,
        deel_invoice_ref,
        deel_worker_id,
        entity,
        invoice_currency,
        invoice_date,
        invoice_serial,
        item_description,
        payed_date,
        receipt_serial,
        type_of_adjustment,
        worker_name
      )
      VALUES $$deelDocumentRecords(
        amount,
        amountInvoiceCurrency,
        contractId,
        contractOrFeeDescription,
        currency,
        deelInvoiceRef,
        deelWorkerId,
        entity,
        invoiceCurrency,
        invoiceDate,
        invoiceSerial,
        itemDescription,
        payedDate,
        receiptSerial,
        typeOfAdjustment,
        workerName
      )
      RETURNING *;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class DeelProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchDocumentRecordsByPaymentDates(paymentDates: readonly TimelessDateString[]) {
    const records = await getDocumentRecordsByPaymentDates.run({ paymentDates }, this.dbProvider);
    return paymentDates.map(date => {
      return records.filter(record => dateToTimelessDateString(record.payed_date) === date);
    });
  }

  public getDocumentRecordsByPaymentDateLoader = new DataLoader(
    (dates: readonly TimelessDateString[]) => this.batchDocumentRecordsByPaymentDates(dates),
    {
      cacheKeyFn: key => `records-payment-date-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchDocumentRecordsByInvoiceDates(invoiceDates: readonly TimelessDateString[]) {
    const records = await getDocumentRecordsByInvoiceDates.run({ invoiceDates }, this.dbProvider);
    return invoiceDates.map(date => {
      return records.filter(record => dateToTimelessDateString(record.invoice_date) === date);
    });
  }

  public getDocumentRecordsByInvoiceDateLoader = new DataLoader(
    (dates: readonly TimelessDateString[]) => this.batchDocumentRecordsByInvoiceDates(dates),
    {
      cacheKeyFn: key => `records-invoice-date-${key}`,
      cacheMap: this.cache,
    },
  );

  public async updateDocumentRecord(params: IUpdateDocumentRecordParams) {
    try {
      // invalidate cache
      return updateDocumentRecord.run(params, this.dbProvider);
    } catch (e) {
      const message = `Error updating Deel record [${params.recordId}]`;
      console.error(message, e);
      throw new Error(message);
    }
  }

  public async insertDeelDocumentRecords(params: IInsertDeelDocumentRecordsParams) {
    try {
      // invalidate cache
      return insertDeelDocumentRecords.run(params, this.dbProvider);
    } catch (e) {
      const message = `Error inserting Deel document record`;
      console.error(message, e);
      throw new Error(message);
    }
  }
}
