import { Injectable, Scope } from 'graphql-modules';
// eslint-disable-next-line no-restricted-imports
import type { PoolClient } from 'pg';
import { sql } from '@pgtyped/runtime';
import { makeUUID } from '../../../demo-fixtures/helpers/deterministic-uuid.js';
import { UUID_REGEX } from '../../../shared/constants.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IEnsureBusinessQuery,
  IEnsureCountryQuery,
  IEnsureFinancialEntityQuery,
  IEnsureTaxCategoryQuery,
} from '../types.js';

export type FinancialEntityType = 'business' | 'tax_category' | 'tag';

const VALID_ENTITY_TYPES: readonly FinancialEntityType[] = ['business', 'tax_category', 'tag'];

export interface EnsureFinancialEntityParams {
  id?: string;
  name: string;
  type: FinancialEntityType;
  ownerId?: string;
}

export interface EnsureBusinessOptions {
  ownerId?: string;
  country?: string;
  isDocumentsOptional?: boolean;
  hebrewName?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  email?: string;
  website?: string;
  phoneNumber?: string;
  governmentId?: string;
  exemptDealer?: boolean;
  optionalVat?: boolean;
  isReceiptEnough?: boolean;
}

export interface EnsureTaxCategoryOptions {
  ownerId?: string;
  hashavshevetName?: string;
  taxExcluded?: boolean;
}

const ensureFinancialEntity = sql<IEnsureFinancialEntityQuery>`
  INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
  VALUES ($id, $name, $type, $ownerId)
  ON CONFLICT (id) DO NOTHING;
`;

const ensureBusiness = sql<IEnsureBusinessQuery>`
  INSERT INTO accounter_schema.businesses (
    id, hebrew_name, address, city, zip_code, email, website, phone_number,
    vat_number, exempt_dealer, optional_vat, country,
    can_settle_with_receipt, no_invoices_required, owner_id
  )
  VALUES (
    $id, $hebrewName, $address, $city, $zipCode, $email, $website, $phoneNumber,
    $governmentId, $exemptDealer, $optionalVat, $country,
    $isReceiptEnough, $isDocumentsOptional, $ownerId
  )
  ON CONFLICT (id) DO NOTHING;
`;

const ensureTaxCategory = sql<IEnsureTaxCategoryQuery>`
  INSERT INTO accounter_schema.tax_categories (id, hashavshevet_name, tax_excluded, owner_id)
  VALUES ($id, $hashavshevetName, $taxExcluded, $ownerId)
  ON CONFLICT (id) DO NOTHING;
`;

const ensureCountry = sql<IEnsureCountryQuery>`
  INSERT INTO accounter_schema.countries (code, name)
  VALUES ($code, $name)
  ON CONFLICT (code) DO NOTHING;
`;

@Injectable({ scope: Scope.Operation, global: true })
export class EntityEnsureProvider {
  constructor(private db: TenantAwareDBClient) {}

  async ensureFinancialEntity(
    params: EnsureFinancialEntityParams,
    client?: PoolClient,
  ): Promise<{ id: string }> {
    const { name, type, ownerId, id: originId } = params;

    if (!name || name.trim() === '') {
      throw new Error('ensureFinancialEntity: name is required');
    }
    if (!VALID_ENTITY_TYPES.includes(type)) {
      throw new Error(`ensureFinancialEntity: invalid type "${type}"`);
    }

    const compositeKey = ownerId ? `${name}:owner=${ownerId}` : name;
    const id = originId ?? makeUUID(type, compositeKey);

    await ensureFinancialEntity.run(
      { id, name, type, ownerId: ownerId ?? null },
      client ?? this.db,
    );

    return { id };
  }

  async ensureBusinessForEntity(
    entityId: string,
    options?: EnsureBusinessOptions,
    client?: PoolClient,
  ): Promise<void> {
    if (!UUID_REGEX.test(entityId)) {
      throw new Error(`ensureBusinessForEntity: invalid entityId "${entityId}"`);
    }

    await ensureBusiness.run(
      {
        id: entityId,
        hebrewName: options?.hebrewName ?? null,
        address: options?.address ?? null,
        city: options?.city ?? null,
        zipCode: options?.zipCode ?? null,
        email: options?.email ?? null,
        website: options?.website ?? null,
        phoneNumber: options?.phoneNumber ?? null,
        governmentId: options?.governmentId ?? null,
        exemptDealer: options?.exemptDealer ?? false,
        optionalVat: options?.optionalVat ?? false,
        country: options?.country ?? 'ISR',
        isReceiptEnough: options?.isReceiptEnough ?? false,
        isDocumentsOptional: options?.isDocumentsOptional ?? false,
        ownerId: options?.ownerId ?? null,
      },
      client ?? this.db,
    );
  }

  async ensureTaxCategoryForEntity(
    entityId: string,
    options?: EnsureTaxCategoryOptions,
    client?: PoolClient,
  ): Promise<void> {
    if (!UUID_REGEX.test(entityId)) {
      throw new Error(`ensureTaxCategoryForEntity: invalid entityId "${entityId}"`);
    }

    await ensureTaxCategory.run(
      {
        id: entityId,
        hashavshevetName: options?.hashavshevetName ?? null,
        taxExcluded: options?.taxExcluded ?? false,
        ownerId: options?.ownerId ?? null,
      },
      client ?? this.db,
    );
  }

  async ensureCountry(code: string, name: string, client?: PoolClient): Promise<void> {
    await ensureCountry.run({ code, name }, client ?? this.db);
  }
}
