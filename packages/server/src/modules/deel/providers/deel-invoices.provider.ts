import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '../../../shared/helpers/index.js';
import type {
  IGetChargeIdsByPaymentIdsQuery,
  IGetInvoicesByIdsQuery,
  IGetInvoicesByIssueDatesQuery,
  IGetReceiptToChargeQuery,
  IInsertDeelInvoiceRecordsParams,
  IInsertDeelInvoiceRecordsQuery,
} from '../types.js';

const getInvoicesByIssueDates = sql<IGetInvoicesByIssueDatesQuery>`
  SELECT *
  FROM accounter_schema.deel_invoices
  WHERE issued_at >= $from
    AND issued_at <= $to;`;

const getInvoicesByIds = sql<IGetInvoicesByIdsQuery>`
  SELECT *
  FROM accounter_schema.deel_invoices
  WHERE id in $$ids;`;

const getChargeIdsByPaymentIds = sql<IGetChargeIdsByPaymentIdsQuery>`
  SELECT d.charge_id, i.payment_id
  FROM accounter_schema.deel_invoices i
  LEFT JOIN accounter_schema.documents d
    ON i.document_id = d.id AND d.charge_id IS NOT NULL
  WHERE i.payment_id in $$paymentIds;`;

const getReceiptToCharge = sql<IGetReceiptToChargeQuery>`
SELECT DISTINCT ON (di.payment_id)
    di.payment_id,
    d.charge_id
FROM
    accounter_schema.deel_invoices di
LEFT JOIN accounter_schema.documents d
    ON d.id = di.document_id
ORDER BY
    di.payment_id, di.created_at ASC;`;

const insertDeelInvoiceRecords = sql<IInsertDeelInvoiceRecordsQuery>`
      INSERT INTO accounter_schema.deel_invoices (
        id,
        document_id,
        amount,
        contract_id,
        created_at,
        currency,
        deel_fee,
        due_date,
        is_overdue,
        issued_at,
        label,
        paid_at,
        status,
        total,
        vat_id,
        vat_percentage,
        vat_total,
        adjustment,
        approve_date,
        approvers,
        bonus,
        commissions,
        contract_country,
        contract_start_date,
        contract_type,
        contractor_email,
        contractor_employee_name,
        contractor_unique_identifier,
        deductions,
        expenses,
        frequency,
        general_ledger_account,
        group_id,
        others,
        overtime,
        payment_currency,
        pro_rata,
        processing_fee,
        "work",
        total_payment_currency,
        payment_id)
      VALUES ($id,
        $documentId,
        $amount,
        $contractId,
        $createdAt,
        $currency,
        $deelFee,
        $dueDate,
        $isOverdue,
        $issuedAt,
        $label,
        $paidAt,
        $status,
        $total,
        $vatId,
        $vatPercentage,
        $vatTotal,
        $adjustment,
        $approveDate,
        $approvers,
        $bonus,
        $commissions,
        $contractCountry,
        $contractStartDate,
        $contractType,
        $contractorEmail,
        $contractorEmployeeName,
        $contractorUniqueIdentifier,
        $deductions,
        $expenses,
        $frequency,
        $generalLedgerAccount,
        $groupId,
        $others,
        $overtime,
        $paymentCurrency,
        $proRata,
        $processingFee,
        $work,
        $totalPaymentCurrency,
        $paymentId)
      RETURNING *;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class DeelInvoicesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchInvoicesByIssueDates(issueDates: readonly Date[]) {
    const times = issueDates.map(date => date.getTime());
    const from = new Date(Math.min(...times));
    const to = new Date(Math.max(...times));
    const records = await getInvoicesByIssueDates.run({ from, to }, this.dbProvider);
    return issueDates.map(date => {
      return records.filter(record => record.issued_at.getTime() === date.getTime());
    });
  }

  public async getInvoicesByIssueDates(from: Date, to: Date) {
    try {
      return getInvoicesByIssueDates.run({ from, to }, this.dbProvider);
    } catch (e) {
      const message = `Error getting Deel invoices by issue dates`;
      console.error(message, e);
      throw new Error(message);
    }
  }

  public getInvoicesByIssueDateLoader = new DataLoader(
    (dates: readonly Date[]) => this.batchInvoicesByIssueDates(dates),
    {
      cacheKeyFn: key => `invoices-issue-date-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchInvoicesByIds(ids: readonly string[]) {
    const invoices = await getInvoicesByIds.run({ ids }, this.dbProvider);
    return ids.map(id => invoices.find(invoice => invoice.id === id));
  }

  public getInvoicesByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchInvoicesByIds(ids),
    {
      cacheKeyFn: key => `invoices-id-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchChargeIdsByPaymentIds(paymentIds: readonly string[]) {
    const matches = await getChargeIdsByPaymentIds.run({ paymentIds }, this.dbProvider);
    return paymentIds.map(
      paymentId => matches.find(match => match.payment_id === paymentId)?.charge_id,
    );
  }

  public getChargeIdByPaymentIdLoader = new DataLoader(
    (paymentIds: readonly string[]) => this.batchChargeIdsByPaymentIds(paymentIds),
    {
      cacheKeyFn: key => `charge-by-payment-${key}`,
      cacheMap: this.cache,
    },
  );

  public async getReceiptToCharge() {
    try {
      const records = await getReceiptToCharge.run(undefined, this.dbProvider);
      const receiptChargeMap = new Map<string, string>();
      for (const record of records) {
        if (record.charge_id) {
          receiptChargeMap.set(record.payment_id, record.charge_id);
        }
      }
      return receiptChargeMap;
    } catch (e) {
      const message = `Error getting receipt to charge mapping`;
      console.error(message, e);
      throw new Error(message);
    }
  }

  public async insertDeelInvoiceRecords(params: IInsertDeelInvoiceRecordsParams) {
    try {
      // invalidate cache
      return insertDeelInvoiceRecords.run(params, this.dbProvider);
    } catch (e) {
      const message = `Error inserting Deel invoice`;
      console.error(message, e);
      throw new Error(message);
    }
  }
}
