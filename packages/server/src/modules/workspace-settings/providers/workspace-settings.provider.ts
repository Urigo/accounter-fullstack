import { GraphQLError } from 'graphql';
import { v2 as cloudinary } from 'cloudinary';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { ENVIRONMENT } from '../../../shared/tokens.js';
import type { Environment } from '../../../shared/types/index.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { decryptCredentials, encryptCredentials, hasEncryptionKey } from '../helpers/crypto.js';

export interface WorkspaceSettingsRow {
  id: string;
  owner_id: string;
  company_name: string | null;
  company_registration_number: string | null;
  logo_url: string | null;
  default_currency: string | null;
  aging_threshold_days: number | null;
  matching_tolerance_amount: number | null;
  billing_currency: string | null;
  billing_payment_terms_days: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface SourceConnectionRow {
  id: string;
  owner_id: string;
  provider: string;
  display_name: string;
  account_identifier: string | null;
  status: string;
  credentials_encrypted: Buffer | null;
  credentials_iv: Buffer | null;
  credentials_tag: Buffer | null;
  last_sync_at: Date | null;
  last_sync_error: string | null;
  financial_account_id: string | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable({
  scope: Scope.Operation,
})
export class WorkspaceSettingsProvider {
  constructor(
    private db: TenantAwareDBClient,
    private authContextProvider: AuthContextProvider,
    @Inject(ENVIRONMENT) private env: Environment,
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

  async getWorkspaceSettings(): Promise<WorkspaceSettingsRow | null> {
    const ownerId = await this.getOwnerId();
    const result = await this.db.query<WorkspaceSettingsRow>(
      `SELECT * FROM accounter_schema.workspace_settings WHERE owner_id = $1`,
      [ownerId],
    );
    return result.rows[0] ?? null;
  }

  async upsertWorkspaceSettings(input: {
    companyName?: string | null;
    companyRegistrationNumber?: string | null;
    logoUrl?: string | null;
    defaultCurrency?: string | null;
    agingThresholdDays?: number | null;
    matchingToleranceAmount?: number | null;
    billingCurrency?: string | null;
    billingPaymentTermsDays?: number | null;
  }): Promise<WorkspaceSettingsRow> {
    const ownerId = await this.getOwnerId();
    const result = await this.db.query<WorkspaceSettingsRow>(
      `INSERT INTO accounter_schema.workspace_settings
         (owner_id, company_name, company_registration_number, logo_url, default_currency,
          aging_threshold_days, matching_tolerance_amount, billing_currency, billing_payment_terms_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (owner_id) DO UPDATE SET
         company_name = COALESCE($2, accounter_schema.workspace_settings.company_name),
         company_registration_number = COALESCE($3, accounter_schema.workspace_settings.company_registration_number),
         logo_url = COALESCE($4, accounter_schema.workspace_settings.logo_url),
         default_currency = COALESCE($5, accounter_schema.workspace_settings.default_currency),
         aging_threshold_days = COALESCE($6, accounter_schema.workspace_settings.aging_threshold_days),
         matching_tolerance_amount = COALESCE($7, accounter_schema.workspace_settings.matching_tolerance_amount),
         billing_currency = COALESCE($8, accounter_schema.workspace_settings.billing_currency),
         billing_payment_terms_days = COALESCE($9, accounter_schema.workspace_settings.billing_payment_terms_days),
         updated_at = NOW()
       RETURNING *`,
      [
        ownerId,
        input.companyName ?? null,
        input.companyRegistrationNumber ?? null,
        input.logoUrl ?? null,
        input.defaultCurrency ?? null,
        input.agingThresholdDays ?? null,
        input.matchingToleranceAmount ?? null,
        input.billingCurrency ?? null,
        input.billingPaymentTermsDays ?? null,
      ],
    );
    if (!result.rows[0]) {
      throw new GraphQLError('Failed to upsert workspace settings');
    }
    return result.rows[0];
  }

  async getSourceConnections(): Promise<SourceConnectionRow[]> {
    const ownerId = await this.getOwnerId();
    const result = await this.db.query<SourceConnectionRow>(
      `SELECT * FROM accounter_schema.source_connections WHERE owner_id = $1 ORDER BY created_at`,
      [ownerId],
    );
    return result.rows;
  }

  async getSourceConnectionById(id: string): Promise<SourceConnectionRow | null> {
    const ownerId = await this.getOwnerId();
    const result = await this.db.query<SourceConnectionRow>(
      `SELECT * FROM accounter_schema.source_connections WHERE id = $1 AND owner_id = $2`,
      [id, ownerId],
    );
    return result.rows[0] ?? null;
  }

  async createSourceConnection(input: {
    provider: string;
    displayName: string;
    accountIdentifier?: string | null;
    credentials?: Record<string, string> | null;
    financialAccountId?: string | null;
  }): Promise<SourceConnectionRow> {
    const ownerId = await this.getOwnerId();

    let credentialsEncrypted: Buffer | null = null;
    let credentialsIv: Buffer | null = null;
    let credentialsTag: Buffer | null = null;

    if (input.credentials && Object.keys(input.credentials).length > 0) {
      if (!hasEncryptionKey()) {
        throw new GraphQLError(
          'SETTINGS_ENCRYPTION_KEY is not configured. Cannot store credentials.',
        );
      }
      const { encrypted, iv, tag } = encryptCredentials(JSON.stringify(input.credentials));
      credentialsEncrypted = encrypted;
      credentialsIv = iv;
      credentialsTag = tag;
    }

    const result = await this.db.query<SourceConnectionRow>(
      `INSERT INTO accounter_schema.source_connections
         (owner_id, provider, display_name, account_identifier, credentials_encrypted, credentials_iv, credentials_tag, financial_account_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
       RETURNING *`,
      [
        ownerId,
        input.provider,
        input.displayName,
        input.accountIdentifier ?? null,
        credentialsEncrypted,
        credentialsIv,
        credentialsTag,
        input.financialAccountId ?? null,
      ],
    );
    if (!result.rows[0]) {
      throw new GraphQLError('Failed to create source connection');
    }
    return result.rows[0];
  }

  async updateSourceConnection(
    id: string,
    input: {
      displayName?: string | null;
      accountIdentifier?: string | null;
      credentials?: Record<string, string> | null;
      status?: string | null;
      financialAccountId?: string | null;
    },
  ): Promise<SourceConnectionRow> {
    const existing = await this.getSourceConnectionById(id);
    if (!existing) {
      throw new GraphQLError('Source connection not found');
    }

    let credentialsEncrypted: Buffer | null = existing.credentials_encrypted;
    let credentialsIv: Buffer | null = existing.credentials_iv;
    let credentialsTag: Buffer | null = existing.credentials_tag;

    if (input.credentials === null) {
      credentialsEncrypted = null;
      credentialsIv = null;
      credentialsTag = null;
    } else if (input.credentials) {
      if (!hasEncryptionKey()) {
        throw new GraphQLError(
          'SETTINGS_ENCRYPTION_KEY is not configured. Cannot store credentials.',
        );
      }
      const { encrypted, iv, tag } = encryptCredentials(JSON.stringify(input.credentials));
      credentialsEncrypted = encrypted;
      credentialsIv = iv;
      credentialsTag = tag;
    }

    const result = await this.db.query<SourceConnectionRow>(
      `UPDATE accounter_schema.source_connections SET
         display_name = COALESCE($2, display_name),
         account_identifier = COALESCE($3, account_identifier),
         credentials_encrypted = $4,
         credentials_iv = $5,
         credentials_tag = $6,
         status = COALESCE($7, status),
         financial_account_id = COALESCE($8, financial_account_id),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        input.displayName ?? null,
        input.accountIdentifier ?? null,
        credentialsEncrypted,
        credentialsIv,
        credentialsTag,
        input.status ?? null,
        input.financialAccountId ?? null,
      ],
    );
    if (!result.rows[0]) {
      throw new GraphQLError('Failed to update source connection');
    }
    return result.rows[0];
  }

  async deleteSourceConnection(id: string): Promise<boolean> {
    const ownerId = await this.getOwnerId();
    const result = await this.db.query(
      `DELETE FROM accounter_schema.source_connections WHERE id = $1 AND owner_id = $2`,
      [id, ownerId],
    );
    return result.rowCount > 0;
  }

  async getDecryptedCredentials(id: string): Promise<Record<string, string> | null> {
    const conn = await this.getSourceConnectionById(id);
    if (!conn?.credentials_encrypted || !conn.credentials_iv || !conn.credentials_tag) {
      return null;
    }
    if (!hasEncryptionKey()) {
      throw new GraphQLError('SETTINGS_ENCRYPTION_KEY is not configured. Cannot decrypt.');
    }
    const plaintext = decryptCredentials(
      conn.credentials_encrypted,
      conn.credentials_iv,
      conn.credentials_tag,
    );
    return JSON.parse(plaintext) as Record<string, string>;
  }

  async uploadLogo(fileBase64: string, mimeType: string): Promise<WorkspaceSettingsRow> {
    const cloudinaryEnv = this.env.cloudinary;
    if (!cloudinaryEnv) {
      throw new GraphQLError(
        'Cloudinary is not configured. Set CLOUDINARY_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      );
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!ALLOWED_TYPES.includes(mimeType)) {
      throw new GraphQLError(
        `Unsupported file type: ${mimeType}. Allowed: JPEG, PNG, GIF, WEBP, SVG.`,
      );
    }

    const ownerId = await this.getOwnerId();

    cloudinary.config({
      cloud_name: cloudinaryEnv.name,
      api_key: cloudinaryEnv.apiKey,
      api_secret: cloudinaryEnv.apiSecret,
      secure: true,
    });

    const dataUri = `data:${mimeType};base64,${fileBase64}`;

    const res = await cloudinary.uploader.upload(dataUri, {
      folder: `workspace-logos/${ownerId}`,
      resource_type: 'image',
      overwrite: true,
      public_id: 'logo',
      transformation: [{ width: 256, height: 256, crop: 'limit' }],
    });

    return this.upsertWorkspaceSettings({ logoUrl: res.secure_url });
  }

  async removeLogo(): Promise<WorkspaceSettingsRow> {
    const ownerId = await this.getOwnerId();
    const result = await this.db.query<WorkspaceSettingsRow>(
      `INSERT INTO accounter_schema.workspace_settings (owner_id, logo_url)
       VALUES ($1, NULL)
       ON CONFLICT (owner_id) DO UPDATE SET logo_url = NULL, updated_at = NOW()
       RETURNING *`,
      [ownerId],
    );
    if (!result.rows[0]) {
      throw new GraphQLError('Failed to remove logo');
    }
    return result.rows[0];
  }

  /** Maps provider name to the DB table and date column used for row counts. */
  private static readonly SOURCE_TABLE_MAP: Record<string, { table: string; dateCol: string }> = {
    mizrahi: { table: 'accounter_schema.bank_mizrahi_transactions', dateCol: 'date' },
    isracard: { table: 'accounter_schema.isracard_alt_transactions', dateCol: 'date' },
    priority: { table: 'accounter_schema.priority_invoices', dateCol: 'curdate' },
    hapoalim: { table: 'accounter_schema.poalim_ils_account_transactions', dateCol: 'event_date' },
    cal: { table: 'accounter_schema.cal_creditcard_transactions', dateCol: 'event_date' },
    discount: { table: 'accounter_schema.bank_discount_transactions', dateCol: 'event_date' },
    max: { table: 'accounter_schema.max_creditcard_transactions', dateCol: 'event_date' },
    amex: { table: 'accounter_schema.amex_creditcard_transactions', dateCol: 'event_date' },
  };

  async getDashboardStats(): Promise<{
    sources: Array<{
      sourceConnectionId: string;
      provider: string;
      displayName: string;
      status: string;
      lastSyncAt: Date | null;
      lastSyncError: string | null;
      rowCount: number;
      oldestRecord: string | null;
      newestRecord: string | null;
      monthlyData: Array<{ month: string; count: number }>;
    }>;
    financial: {
      totalCharges: number;
      totalTransactions: number;
      transactionsThisMonth: number;
      transactionsLastMonth: number;
      totalDocuments: number;
    };
    generatedAt: Date;
  }> {
    const ownerId = await this.getOwnerId();
    const connections = await this.getSourceConnections();

    const sources = await Promise.all(
      connections.map(async conn => {
        const mapping = WorkspaceSettingsProvider.SOURCE_TABLE_MAP[conn.provider];
        let rowCount = 0;
        let oldestRecord: string | null = null;
        let newestRecord: string | null = null;
        let monthlyData: Array<{ month: string; count: number }> = [];

        if (mapping) {
          try {
            const [countRes, rangeRes, monthlyRes] = await Promise.all([
              this.db.query<{ count: string }>(
                `SELECT COUNT(*)::text AS count FROM ${mapping.table}`,
              ),
              this.db.query<{ oldest: string | null; newest: string | null }>(
                `SELECT MIN(${mapping.dateCol})::text AS oldest, MAX(${mapping.dateCol})::text AS newest FROM ${mapping.table}`,
              ),
              this.db.query<{ month: string; count: string }>(
                `SELECT TO_CHAR(DATE_TRUNC('month', ${mapping.dateCol}::date), 'YYYY-MM') AS month,
                        COUNT(*)::text AS count
                 FROM ${mapping.table}
                 WHERE ${mapping.dateCol}::date >= NOW() - INTERVAL '26 months'
                 GROUP BY month
                 ORDER BY month`,
              ),
            ]);
            rowCount = parseInt(countRes.rows[0]?.count ?? '0', 10);
            oldestRecord = rangeRes.rows[0]?.oldest ?? null;
            newestRecord = rangeRes.rows[0]?.newest ?? null;
            monthlyData = monthlyRes.rows.map(r => ({
              month: r.month,
              count: parseInt(r.count, 10),
            }));
          } catch {
            // table may not exist yet
          }
        }

        return {
          sourceConnectionId: conn.id,
          provider: conn.provider,
          displayName: conn.display_name,
          status: conn.status,
          lastSyncAt: conn.last_sync_at,
          lastSyncError: conn.last_sync_error,
          rowCount,
          oldestRecord,
          newestRecord,
          monthlyData,
        };
      }),
    );

    const [chargesRes, txRes, txThisMonthRes, txLastMonthRes, docsRes] = await Promise.all([
      this.db
        .query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM accounter_schema.charges WHERE owner_id = $1`,
          [ownerId],
        )
        .catch(() => ({ rows: [{ count: '0' }] })),
      this.db
        .query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM accounter_schema.transactions t
           JOIN accounter_schema.charges c ON c.id = t.charge_id WHERE c.owner_id = $1`,
          [ownerId],
        )
        .catch(() => ({ rows: [{ count: '0' }] })),
      this.db
        .query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM accounter_schema.transactions t
           JOIN accounter_schema.charges c ON c.id = t.charge_id
           WHERE c.owner_id = $1 AND t.event_date >= date_trunc('month', NOW())`,
          [ownerId],
        )
        .catch(() => ({ rows: [{ count: '0' }] })),
      this.db
        .query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM accounter_schema.transactions t
           JOIN accounter_schema.charges c ON c.id = t.charge_id
           WHERE c.owner_id = $1
             AND t.event_date >= date_trunc('month', NOW()) - interval '1 month'
             AND t.event_date < date_trunc('month', NOW())`,
          [ownerId],
        )
        .catch(() => ({ rows: [{ count: '0' }] })),
      this.db
        .query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM accounter_schema.documents d
           JOIN accounter_schema.charges c ON c.id = d.charge_id WHERE c.owner_id = $1`,
          [ownerId],
        )
        .catch(() => ({ rows: [{ count: '0' }] })),
    ]);

    return {
      sources,
      financial: {
        totalCharges: parseInt(chargesRes.rows[0]?.count ?? '0', 10),
        totalTransactions: parseInt(txRes.rows[0]?.count ?? '0', 10),
        transactionsThisMonth: parseInt(txThisMonthRes.rows[0]?.count ?? '0', 10),
        transactionsLastMonth: parseInt(txLastMonthRes.rows[0]?.count ?? '0', 10),
        totalDocuments: parseInt(docsRes.rows[0]?.count ?? '0', 10),
      },
      generatedAt: new Date(),
    };
  }

  async updateSyncStatus(
    id: string,
    status: string,
    error?: string | null,
  ): Promise<SourceConnectionRow> {
    const result = await this.db.query<SourceConnectionRow>(
      `UPDATE accounter_schema.source_connections SET
         status = $2,
         last_sync_at = NOW(),
         last_sync_error = $3,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status, error ?? null],
    );
    if (!result.rows[0]) {
      throw new GraphQLError('Source connection not found');
    }
    return result.rows[0];
  }
}
