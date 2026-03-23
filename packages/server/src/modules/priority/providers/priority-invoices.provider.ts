import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import type { PriorityInvoiceRaw } from '../../app-providers/priority/priority-client.provider.js';

export interface PriorityInvoiceRow {
  id: string;
  owner_id: string;
  source_connection_id: string | null;
  ivnum: string;
  ivtype: string | null;
  custname: string | null;
  cust_vatid: string | null;
  curdate: Date | null;
  duedate: Date | null;
  details: string | null;
  currency: string | null;
  net_amount: string | null;
  vat: string | null;
  total: string | null;
  discount: string | null;
  paid: string | null;
  balance: string | null;
  statdes: string | null;
  synced_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface InvoiceFilter {
  custname?: string | null;
  currency?: string | null;
  ivtype?: string | null;
}

@Injectable({
  scope: Scope.Operation,
})
export class PriorityInvoicesProvider {
  constructor(
    private db: TenantAwareDBClient,
    private authContextProvider: AuthContextProvider,
  ) {}

  private async getOwnerId(): Promise<string> {
    const auth = await this.authContextProvider.getAuthContext();
    if (!auth?.tenant?.businessId) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }
    return auth.tenant.businessId;
  }

  async getInvoices(filter: InvoiceFilter = {}): Promise<PriorityInvoiceRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filter.custname) {
      conditions.push(`custname ILIKE $${idx++}`);
      params.push(`%${filter.custname}%`);
    }
    if (filter.currency) {
      conditions.push(`currency = $${idx++}`);
      params.push(filter.currency);
    }
    if (filter.ivtype) {
      conditions.push(`ivtype = $${idx++}`);
      params.push(filter.ivtype);
    }

    const where = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
    const result = await this.db.query<PriorityInvoiceRow>(
      `SELECT * FROM accounter_schema.priority_invoices WHERE TRUE ${where} ORDER BY curdate DESC NULLS LAST, ivnum ASC`,
      params,
    );
    return result.rows;
  }

  async upsertInvoices(
    invoices: PriorityInvoiceRaw[],
    sourceConnectionId: string | null = null,
  ): Promise<{ synced: number; errors: number }> {
    const ownerId = await this.getOwnerId();
    let synced = 0;
    let errors = 0;

    for (const inv of invoices) {
      try {
        await this.db.query(
          `INSERT INTO accounter_schema.priority_invoices (
            owner_id, source_connection_id,
            ivnum, ivtype, custname, cust_vatid,
            curdate, duedate, details, currency,
            net_amount, vat, total, discount, paid, balance,
            statdes, synced_at, raw_json, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, NOW(), $18, NOW()
          )
          ON CONFLICT (owner_id, ivnum) DO UPDATE SET
            ivtype = EXCLUDED.ivtype, custname = EXCLUDED.custname,
            cust_vatid = EXCLUDED.cust_vatid, curdate = EXCLUDED.curdate,
            duedate = EXCLUDED.duedate, details = EXCLUDED.details,
            currency = EXCLUDED.currency, net_amount = EXCLUDED.net_amount,
            vat = EXCLUDED.vat, total = EXCLUDED.total,
            discount = EXCLUDED.discount, paid = EXCLUDED.paid,
            balance = EXCLUDED.balance, statdes = EXCLUDED.statdes,
            synced_at = NOW(), raw_json = EXCLUDED.raw_json, updated_at = NOW()`,
          [
            ownerId, sourceConnectionId,
            inv.IVNUM, inv.IVTYPE ?? null, inv.CUSTNAME ?? null, inv.CUST_VATID ?? null,
            inv.CURDATE ? new Date(inv.CURDATE) : null,
            inv.DUEDATE ? new Date(inv.DUEDATE) : null,
            inv.DETAILS ?? null, inv.CURRENCY ?? null,
            inv.QPRICE ?? null, inv.VAT ?? null, inv.TOTPRICE ?? null,
            inv.DISCOUNT ?? null, inv.PAID ?? null, inv.BALANCE ?? null,
            inv.STATDES ?? null, JSON.stringify(inv),
          ],
        );
        synced++;
      } catch (error) {
        console.error(`Priority: failed to upsert invoice ${inv.IVNUM}:`, error);
        errors++;
      }
    }

    return { synced, errors };
  }

  async updateSourceConnectionStatus(
    sourceConnectionId: string,
    status: string,
  ): Promise<void> {
    await this.db.query(
      `UPDATE accounter_schema.source_connections
       SET status = $2, last_sync_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [sourceConnectionId, status],
    );
  }

  async getSourceConnectionId(): Promise<string | null> {
    const ownerId = await this.getOwnerId();
    const result = await this.db.query<{ id: string }>(
      `SELECT id FROM accounter_schema.source_connections
       WHERE owner_id = $1 AND provider = 'priority' LIMIT 1`,
      [ownerId],
    );
    return result.rows[0]?.id ?? null;
  }
}
