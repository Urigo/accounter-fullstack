import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type { IGetChargesApprovalStatusParams, IGetChargesApprovalStatusQuery } from '../types.js';

const getChargesApprovalStatus = sql<IGetChargesApprovalStatusQuery>`
  SELECT COUNT(*) AS total_charges,
         COUNT(*) FILTER (WHERE accountant_status = 'APPROVED') AS approved_charges,
         COUNT(*) FILTER (WHERE accountant_status = 'PENDING') AS pending_charges,
         COUNT(*) FILTER (WHERE accountant_status = 'UNAPPROVED') AS unapproved_charges
  FROM accounter_schema.extended_charges
  WHERE owner_id in $$ownerIds
  AND GREATEST(documents_max_date, transactions_max_event_date, transactions_max_debit_date, ledger_max_invoice_date, ledger_max_value_date)::TEXT::DATE >= date_trunc('day', $fromDate ::DATE)
  AND LEAST(documents_min_date, transactions_min_event_date, transactions_min_debit_date, ledger_min_invoice_date, ledger_min_value_date)::TEXT::DATE <= date_trunc('day', $toDate ::DATE);`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class AccountantApprovalProvider {
  constructor(private dbProvider: DBProvider) {}

  public getChargesApprovalStatus(params: IGetChargesApprovalStatusParams) {
    return getChargesApprovalStatus.run(params, this.dbProvider);
  }
}
