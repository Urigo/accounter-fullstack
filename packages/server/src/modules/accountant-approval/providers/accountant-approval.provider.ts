import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { ChargesAuthorizationProvider } from '../../charges/providers/charges-authorization.provider.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import type {
  IDegradeChargeAccountantApprovalQuery,
  IGetChargesApprovalStatusParams,
  IGetChargesApprovalStatusQuery,
} from '../types.js';

const getChargesApprovalStatus = sql<IGetChargesApprovalStatusQuery>`
  SELECT COUNT(*) AS total_charges,
         COUNT(*) FILTER (WHERE accountant_status = 'APPROVED') AS approved_charges,
         COUNT(*) FILTER (WHERE accountant_status = 'PENDING') AS pending_charges,
         COUNT(*) FILTER (WHERE accountant_status = 'UNAPPROVED') AS unapproved_charges
  FROM accounter_schema.extended_charges
  WHERE owner_id in $$ownerIds
  AND GREATEST(documents_max_date, transactions_max_event_date, transactions_max_debit_date, ledger_max_invoice_date, ledger_max_value_date)::TEXT::DATE >= date_trunc('day', $fromDate ::DATE)
  AND LEAST(documents_min_date, transactions_min_event_date, transactions_min_debit_date, ledger_min_invoice_date, ledger_min_value_date)::TEXT::DATE <= date_trunc('day', $toDate ::DATE);`;

const degradeChargeAccountantApproval = sql<IDegradeChargeAccountantApprovalQuery>`
  UPDATE accounter_schema.charges
  SET accountant_status = 'PENDING'
  WHERE id = $chargeId
    AND accountant_status = 'APPROVED'
  RETURNING *;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class AccountantApprovalProvider {
  constructor(
    private db: TenantAwareDBClient,
    private auth: ChargesAuthorizationProvider,
    private charges: ChargesProvider,
  ) {}

  public getChargesApprovalStatus(params: IGetChargesApprovalStatusParams) {
    return getChargesApprovalStatus.run(params, this.db);
  }

  /**
   * Degrades a charge's accountant status from APPROVED to PENDING.
   * Meant to be called whenever a charge is modified, so an already-approved
   * charge gets flagged for re-approval. Charges in any other status
   * (UNAPPROVED / PENDING) are left untouched.
   */
  public async degradeChargeAccountantApproval(chargeId: string) {
    await this.auth.canWriteCharge();

    const [newCharge] = await degradeChargeAccountantApproval.run({ chargeId }, this.db);
    if (newCharge) {
      this.charges.getChargeByIdLoader.prime(newCharge.id, newCharge);
    }
    return newCharge;
  }
}
