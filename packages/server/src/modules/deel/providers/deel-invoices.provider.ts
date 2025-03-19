import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IGetInvoicesByIdsQuery,
  IGetInvoicesByIssueDatesQuery,
  IInsertDeelInvoiceRecordsParams,
  IInsertDeelInvoiceRecordsQuery,
} from '../types.js';

const getInvoicesByIssueDates = sql<IGetInvoicesByIssueDatesQuery>`
  SELECT *
  FROM accounter_schema.deel_invoices
  WHERE issued_at <= $from
    AND issued_at >= $to;`;

const getInvoicesByIds = sql<IGetInvoicesByIdsQuery>`
  SELECT *
  FROM accounter_schema.deel_invoices
  WHERE id in $$ids;`;

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
        contractor_email,
        contractor_employee_name,
        contractor_unique_identifier,
        deductions,
        expenses,
        frequency,
        general_ledger_account,
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
        $contractorEmail,
        $contractorEmployeeName,
        $contractorUniqueIdentifier,
        $deductions,
        $expenses,
        $frequency,
        $generalLedgerAccount,
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
