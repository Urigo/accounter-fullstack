import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { reassureOwnerIdExists } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IGetChargeIdsByPaymentIdsQuery,
  IGetInvoicesByIdsQuery,
  IGetInvoicesByIssueDatesQuery,
  IGetReceiptToChargeQuery,
  IInsertDeelInvoiceRecordsParams,
  IInsertDeelInvoiceRecordsQuery,
  IUpdateDeelInvoiceRecordsParams,
  IUpdateDeelInvoiceRecordsQuery,
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
        billing_type,
        contract_id,
        created_at,
        currency,
        deel_fee,
        document_type,
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
        payment_id,
        recipient_legal_entity_id,
        owner_id)
      VALUES ($id,
        $documentId,
        $amount,
        $billingType,
        $contractId,
        $createdAt,
        $currency,
        $deelFee,
        $documentType,
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
        $paymentId,
        $recipientLegalEntityId,
        $ownerId)
      RETURNING *;`;

const updateDeelInvoiceRecords = sql<IUpdateDeelInvoiceRecordsQuery>`
  UPDATE accounter_schema.deel_invoices
  SET
  document_id = COALESCE(
    $documentId,
    document_id
  ),
  amount = COALESCE(
    $amount,
    amount
  ),
  billing_type = COALESCE(
    $billingType,
    billing_type
  ),
  contract_id = COALESCE(
    $contractId,
    contract_id
  ),
  created_at = COALESCE(
    $createdAt,
    created_at
  ),
  currency = COALESCE(
    $currency,
    currency
  ),
  deel_fee = COALESCE(
    $deelFee,
    deel_fee
  ),
  document_type = COALESCE(
    $documentType,
    document_type
  ),
  due_date = COALESCE(
    $dueDate,
    due_date
  ),
  is_overdue = COALESCE(
    $isOverdue,
    is_overdue
  ),
  issued_at = COALESCE(
    $issuedAt,
    issued_at
  ),
  label = COALESCE(
    $label,
    label
  ),
  paid_at = COALESCE(
    $paidAt,
    paid_at
  ),
  status = COALESCE(
    $status,
    status
  ),
  total = COALESCE(
    $total,
    total
  ),
  vat_id = COALESCE(
    $vatId,
    vat_id
  ),
  vat_percentage = COALESCE(
    $vatPercentage,
    vat_percentage
  ),
  vat_total = COALESCE(
    $vatTotal,
    vat_total
  ),
  adjustment = COALESCE(
    $adjustment,
    adjustment
  ),
  approve_date = COALESCE(
    $approveDate,
    approve_date
  ),
  approvers = COALESCE(
    $approvers,
    approvers
  ),
  bonus = COALESCE(
    $bonus,
    bonus
  ),
  commissions = COALESCE(
    $commissions,
    commissions
  ),
  contract_country = COALESCE(
    $contractCountry,
    contract_country
  ),
  contract_start_date = COALESCE(
    $contractStartDate,
    contract_start_date
  ),
  contract_type = COALESCE(
    $contractType,
    contract_type
  ),
  contractor_email = COALESCE(
    $contractorEmail,
    contractor_email
  ),
  contractor_employee_name = COALESCE(
    $contractorEmployeeName,
    contractor_employee_name
  ),
  contractor_unique_identifier = COALESCE(
    $contractorUniqueIdentifier,
    contractor_unique_identifier
  ),
  deductions = COALESCE(
    $deductions,
    deductions
  ),
  expenses = COALESCE(
    $expenses,
    expenses
  ),
  frequency = COALESCE(
    $frequency,
    frequency
  ),
  general_ledger_account = COALESCE(
    $generalLedgerAccount,
    general_ledger_account
  ),
  group_id = COALESCE(
    $groupId,
    group_id
  ),
  others = COALESCE(
    $others,
    others
  ),
  overtime = COALESCE(
    $overtime,
    overtime
  ),
  payment_currency = COALESCE(
    $paymentCurrency,
    payment_currency
  ),
  pro_rata = COALESCE(
    $proRata,
    pro_rata
  ),
  processing_fee = COALESCE(
    $processingFee,
    processing_fee
  ),
  "work" = COALESCE(
    $work,
    work
  ),
  total_payment_currency = COALESCE(
    $totalPaymentCurrency,
    total_payment_currency
  ),
  payment_id = COALESCE(
    $paymentId,
    payment_id
  ),
  recipient_legal_entity_id = COALESCE(
    $recipientLegalEntityId,
    recipient_legal_entity_id
  )
  WHERE
    id = $id
  RETURNING *;
  `;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class DeelInvoicesProvider {
  constructor(
    private db: TenantAwareDBClient,
    private adminContextProvider: AdminContextProvider,
  ) {}

  private async batchInvoicesByIssueDates(issueDates: readonly Date[]) {
    const times = issueDates.map(date => date.getTime());
    const from = new Date(Math.min(...times));
    const to = new Date(Math.max(...times));
    const records = await getInvoicesByIssueDates.run({ from, to }, this.db);
    return issueDates.map(date => {
      return records.filter(record => record.issued_at.getTime() === date.getTime());
    });
  }

  public async getInvoicesByIssueDates(from: Date, to: Date) {
    try {
      return getInvoicesByIssueDates.run({ from, to }, this.db);
    } catch (e) {
      const message = `Error getting Deel invoices by issue dates`;
      console.error(message, e);
      throw new Error(message, { cause: e });
    }
  }

  public getInvoicesByIssueDateLoader = new DataLoader(
    (dates: readonly Date[]) => this.batchInvoicesByIssueDates(dates),
    { cacheKeyFn: date => date.getTime().toString() },
  );

  private async batchInvoicesByIds(ids: readonly string[]) {
    const invoices = await getInvoicesByIds.run({ ids }, this.db);
    return ids.map(id => invoices.find(invoice => invoice.id === id));
  }

  public getInvoicesByIdLoader = new DataLoader((ids: readonly string[]) =>
    this.batchInvoicesByIds(ids),
  );

  private async batchChargeIdsByPaymentIds(paymentIds: readonly string[]) {
    const matches = await getChargeIdsByPaymentIds.run({ paymentIds }, this.db);
    return paymentIds.map(
      paymentId => matches.find(match => match.payment_id === paymentId)?.charge_id,
    );
  }

  public getChargeIdByPaymentIdLoader = new DataLoader((paymentIds: readonly string[]) =>
    this.batchChargeIdsByPaymentIds(paymentIds),
  );

  public async getReceiptToCharge() {
    try {
      const records = await getReceiptToCharge.run(undefined, this.db);
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
      throw new Error(message, { cause: e });
    }
  }

  public async insertDeelInvoiceRecords(params: IInsertDeelInvoiceRecordsParams) {
    try {
      const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
      // invalidate cache
      return insertDeelInvoiceRecords.run(reassureOwnerIdExists(params, ownerId), this.db);
    } catch (e) {
      const message = `Error inserting Deel invoice`;
      console.error(message, e);
      throw new Error(message, { cause: e });
    }
  }

  public async updateDeelInvoiceRecords(params: IUpdateDeelInvoiceRecordsParams) {
    try {
      return updateDeelInvoiceRecords.run(params, this.db);
    } catch (e) {
      const message = `Error updating Deel invoice`;
      console.error(message, e);
      throw new Error(message, { cause: e });
    }
  }
}
