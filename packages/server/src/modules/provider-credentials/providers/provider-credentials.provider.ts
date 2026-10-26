import { GraphQLError } from 'graphql';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { ENVIRONMENT } from '../../../shared/tokens.js';
import type { Environment } from '../../../shared/types/index.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { decryptCredential, encryptCredential } from '../helpers/encryption.js';
import {
  DeelPayloadSchema,
  GreenInvoicePayloadSchema,
  type DeelPayload,
  type GreenInvoicePayload,
} from '../helpers/payload-schemas.js';
import {
  IDeleteProviderCredentialsQuery,
  IGetProviderCredentialPayloadQuery,
  IGetProviderStatusesQuery,
  IIsOwnBusinessQuery,
  ISetProviderBusinessQuery,
  IUpsertProviderCredentialsQuery,
} from '../types.js';

const PROVIDER_SCHEMAS = {
  green_invoice: GreenInvoicePayloadSchema,
  deel: DeelPayloadSchema,
} as const;

export type ProviderKey = keyof typeof PROVIDER_SCHEMAS;

export type ProviderStatus = {
  provider: string;
  configuredAt: string;
  /** The business entity that represents the provider in the tenant's books, if set */
  businessId: string | null;
};

const upsertProviderCredentials = sql<IUpsertProviderCredentialsQuery>`
  INSERT INTO accounter_schema.provider_credentials (owner_id, provider, payload, business_id)
  VALUES (accounter_schema.get_current_business_id(), $provider, $encrypted, $businessId)
  ON CONFLICT (owner_id, provider) DO UPDATE SET
    payload = EXCLUDED.payload,
    business_id = COALESCE(EXCLUDED.business_id, provider_credentials.business_id),
    updated_at = now()
  RETURNING updated_at;`;

// a business id must belong to the tenant: reads (RLS) may reach sibling businesses in scope, and
// the FK check bypasses RLS altogether
const isOwnBusiness = sql<IIsOwnBusinessQuery>`
  SELECT EXISTS (
    SELECT 1
    FROM accounter_schema.businesses
    WHERE id = $businessId
      AND owner_id = accounter_schema.get_current_business_id()
  ) AS "isOwn!";`;

const setProviderBusiness = sql<ISetProviderBusinessQuery>`
  UPDATE accounter_schema.provider_credentials
  SET business_id = $businessId
  WHERE owner_id = accounter_schema.get_current_business_id()
    AND provider = $provider
    AND (
      $businessId::uuid IS NULL
      OR EXISTS (
        SELECT 1
        FROM accounter_schema.businesses
        WHERE id = $businessId
          AND owner_id = accounter_schema.get_current_business_id()
      )
    )
  RETURNING updated_at;`;

const deleteProviderCredentials = sql<IDeleteProviderCredentialsQuery>`
  DELETE FROM accounter_schema.provider_credentials
  WHERE owner_id = accounter_schema.get_current_business_id()
    AND provider = $provider;`;

const getProviderStatuses = sql<IGetProviderStatusesQuery>`
  SELECT provider, updated_at, business_id
  FROM accounter_schema.provider_credentials
  WHERE owner_id = accounter_schema.get_current_business_id();`;

const getProviderCredentialPayload = sql<IGetProviderCredentialPayloadQuery>`
  SELECT payload
  FROM accounter_schema.provider_credentials
  WHERE owner_id = accounter_schema.get_current_business_id()
    AND provider = $provider;`;

@Injectable({ scope: Scope.Operation, global: true })
export class ProviderCredentialsProvider {
  /** Statuses are read once per operation — ledger generation asks for them per document */
  private statusesPromise: Promise<ProviderStatus[]> | null = null;

  constructor(
    private db: TenantAwareDBClient,
    @Inject(ENVIRONMENT) private env: Environment,
  ) {}

  private get encryptionKey(): string {
    const key = this.env.credentialsEncryptionKey;
    if (!key) {
      throw new GraphQLError('Credentials encryption key is not configured', {
        extensions: { code: 'INTERNAL_SERVER_ERROR' },
      });
    }
    return key;
  }

  async setCredentials(
    provider: ProviderKey,
    payload: unknown,
    options: { businessId?: string | null } = {},
  ): Promise<Date | undefined> {
    const schema = PROVIDER_SCHEMAS[provider];
    const result = schema.safeParse(payload);
    if (!result.success) {
      throw new GraphQLError(`Invalid credentials for provider "${provider}"`, {
        extensions: { code: 'BAD_USER_INPUT', details: result.error.flatten() },
      });
    }

    const encrypted = encryptCredential(JSON.stringify(result.data), this.encryptionKey);
    if (options.businessId) {
      await this.assertOwnBusiness(options.businessId);
    }

    return this.write(async () => {
      const credentials = await upsertProviderCredentials.run(
        { provider, encrypted, businessId: options.businessId ?? null },
        this.db,
      );
      return credentials[0]?.updated_at;
    });
  }

  /**
   * Set the business entity that represents the provider in the tenant's books, or clear it with
   * `null`. The provider must already be connected, and the business must belong to the tenant.
   */
  async setProviderBusiness(provider: ProviderKey, businessId: string | null): Promise<Date> {
    if (businessId) {
      await this.assertOwnBusiness(businessId);
    }
    const [row] = await this.write(() =>
      setProviderBusiness.run({ provider, businessId }, this.db),
    );
    if (!row?.updated_at) {
      throw new GraphQLError(
        `Provider "${provider}" is not connected — connect it before choosing its business`,
        { extensions: { code: 'NOT_FOUND' } },
      );
    }
    return row.updated_at;
  }

  async deleteCredentials(provider: ProviderKey): Promise<void> {
    await this.write(() => deleteProviderCredentials.run({ provider }, this.db));
  }

  private async assertOwnBusiness(businessId: string): Promise<void> {
    const [row] = await isOwnBusiness.run({ businessId }, this.db);
    if (!row?.isOwn) {
      throw new GraphQLError(`Business [${businessId}] doesn't belong to this workspace`, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
  }

  /**
   * Run a write, dropping the memoized statuses both before and after it: a read that starts while
   * the write is in flight would otherwise cache the pre-write rows for the rest of the operation.
   */
  private async write<T>(run: () => Promise<T>): Promise<T> {
    this.statusesPromise = null;
    try {
      return await run();
    } finally {
      this.statusesPromise = null;
    }
  }

  getProviderStatuses(): Promise<ProviderStatus[]> {
    this.statusesPromise ??= getProviderStatuses
      .run(undefined, this.db)
      .then(rows =>
        rows.map(row => ({
          provider: row.provider!,
          configuredAt: row.updated_at!.toISOString(),
          businessId: row.business_id ?? null,
        })),
      )
      .catch(error => {
        this.statusesPromise = null;
        throw error;
      });
    return this.statusesPromise;
  }

  async getGreenInvoiceCredentials(): Promise<GreenInvoicePayload | null> {
    return this._getDecrypted<GreenInvoicePayload>('green_invoice', GreenInvoicePayloadSchema);
  }

  async getDeelCredentials(): Promise<DeelPayload | null> {
    return this._getDecrypted<DeelPayload>('deel', DeelPayloadSchema);
  }

  private async _getDecrypted<T>(
    provider: ProviderKey,
    schema: { parse: (v: unknown) => T },
  ): Promise<T | null> {
    const rows = await getProviderCredentialPayload.run({ provider }, this.db);
    if (rows.length === 0) return null;
    try {
      const plaintext = decryptCredential(rows[0].payload!, this.encryptionKey);
      return schema.parse(JSON.parse(plaintext));
    } catch (err) {
      console.error(
        `[ProviderCredentialsProvider] Failed to decrypt/parse "${provider}" credentials: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new GraphQLError('Failed to retrieve provider credentials', {
        extensions: { code: 'INTERNAL_SERVER_ERROR' },
      });
    }
  }
}
