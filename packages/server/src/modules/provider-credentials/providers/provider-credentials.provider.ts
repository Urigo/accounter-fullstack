import { GraphQLError } from 'graphql';
import { Inject, Injectable, Scope } from 'graphql-modules';
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

const PROVIDER_SCHEMAS = {
  green_invoice: GreenInvoicePayloadSchema,
  deel: DeelPayloadSchema,
} as const;

type ProviderKey = keyof typeof PROVIDER_SCHEMAS;

@Injectable({ scope: Scope.Operation, global: true })
export class ProviderCredentialsProvider {
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

  async setCredentials(provider: ProviderKey, payload: unknown): Promise<void> {
    const schema = PROVIDER_SCHEMAS[provider];
    const result = schema.safeParse(payload);
    if (!result.success) {
      throw new GraphQLError(`Invalid credentials for provider "${provider}"`, {
        extensions: { code: 'BAD_USER_INPUT', details: result.error.flatten() },
      });
    }

    const encrypted = encryptCredential(JSON.stringify(result.data), this.encryptionKey);

    await this.db.query(
      `INSERT INTO accounter_schema.provider_credentials (owner_id, provider, payload)
       VALUES (accounter_schema.get_current_business_id(), $1, $2)
       ON CONFLICT (owner_id, provider) DO UPDATE SET payload = EXCLUDED.payload`,
      [provider, encrypted],
    );
  }

  async deleteCredentials(provider: ProviderKey): Promise<void> {
    await this.db.query(
      `DELETE FROM accounter_schema.provider_credentials
       WHERE owner_id = accounter_schema.get_current_business_id()
         AND provider = $1`,
      [provider],
    );
  }

  async getProviderStatuses(): Promise<Array<{ provider: string; configuredAt: string }>> {
    const { rows } = await this.db.query<{ provider: string; updated_at: Date }>(
      `SELECT provider, updated_at
       FROM accounter_schema.provider_credentials
       WHERE owner_id = accounter_schema.get_current_business_id()`,
    );
    return rows.map(row => ({
      provider: row.provider,
      configuredAt: row.updated_at.toISOString(),
    }));
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
    const { rows } = await this.db.query<{ payload: string }>(
      `SELECT payload
       FROM accounter_schema.provider_credentials
       WHERE owner_id = accounter_schema.get_current_business_id()
         AND provider = $1`,
      [provider],
    );
    if (rows.length === 0) return null;
    try {
      const plaintext = decryptCredential(rows[0].payload, this.encryptionKey);
      return schema.parse(JSON.parse(plaintext));
    } catch (err) {
      console.error(
        `[ProviderCredentialsProvider] Failed to decrypt/parse "${provider}" credentials:`,
        err,
      );
      throw new GraphQLError('Failed to retrieve provider credentials', {
        extensions: { code: 'INTERNAL_SERVER_ERROR' },
      });
    }
  }
}
