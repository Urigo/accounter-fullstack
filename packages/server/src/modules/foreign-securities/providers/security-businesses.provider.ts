import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { Currency } from '../../../shared/enums.js';
import { formatCurrency } from '../../../shared/helpers/amount.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../../financial-entities/providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../../financial-entities/providers/tax-categories.provider.js';
import { buildSecurityBusinessName } from '../helpers/security-business-name.helper.js';
import type {
  IGetAllSecurityBusinessesQuery,
  IGetSecurityBusinessesByIdentifiersQuery,
  IGetSecurityBusinessesByIdsQuery,
  IGetSecurityBusinessesByIsinsQuery,
  IGetSecurityIdentifiersByBusinessIdsQuery,
  IInsertSecurityBusinessQuery,
  IInsertSecurityIdentifierQuery,
  SecurityBusinessDescriptors,
  SecurityBusinessRow,
  SecurityIdentifierRow,
  SecurityIdentifierType,
} from '../types.js';

/**
 * No owner_id predicate anywhere in this file: both tables are FORCE RLS with a
 * tenant_isolation policy, so going through TenantAwareDBClient scopes every read and write
 * to the acting tenant — same contract as the poalim_securities tables.
 */
const getSecurityBusinessesByIds = sql<IGetSecurityBusinessesByIdsQuery>`
  SELECT *
  FROM accounter_schema.businesses_securities
  WHERE id IN $$ids;`;

const getAllSecurityBusinesses = sql<IGetAllSecurityBusinessesQuery>`
  SELECT *
  FROM accounter_schema.businesses_securities;`;

const getSecurityBusinessesByIsins = sql<IGetSecurityBusinessesByIsinsQuery>`
  SELECT *
  FROM accounter_schema.businesses_securities
  WHERE isin = ANY($isins!);`;

const getSecurityBusinessesByIdentifiers = sql<IGetSecurityBusinessesByIdentifiersQuery>`
  SELECT si.identifier_value, bs.*
  FROM accounter_schema.security_identifiers si
  INNER JOIN accounter_schema.businesses_securities bs
    ON bs.id = si.business_id
  WHERE si.identifier_type = $identifierType!
    AND si.identifier_value = ANY($identifierValues!);`;

const getSecurityIdentifiersByBusinessIds = sql<IGetSecurityIdentifiersByBusinessIdsQuery>`
  SELECT *
  FROM accounter_schema.security_identifiers
  WHERE business_id IN $$businessIds
  ORDER BY identifier_type, identifier_value;`;

const insertSecurityBusiness = sql<IInsertSecurityBusinessQuery>`
  INSERT INTO accounter_schema.businesses_securities (
    id, owner_id, isin, symbol, eng_name, heb_name, exchange,
    currency_code, item_type, stock_type, is_etf, is_foreign, issuer_country_code
  )
  VALUES (
    $id!, $ownerId!, $isin!, $symbol, $engName, $hebName, $exchange,
    $currencyCode, $itemType, $stockType, $isEtf, $isForeign, $issuerCountryCode
  )
  RETURNING *;`;

const insertSecurityIdentifier = sql<IInsertSecurityIdentifierQuery>`
  INSERT INTO accounter_schema.security_identifiers (
    owner_id, business_id, identifier_type, identifier_value
  )
  VALUES ($ownerId!, $businessId!, $identifierType!, $identifierValue!)
  ON CONFLICT (owner_id, identifier_type, identifier_value) DO NOTHING;`;

/**
 * `businesses_securities.currency_code` is `accounter_schema.currency`, but the securities
 * feeds are not: Poalim spells its currencies out in Hebrew (`דולר ארה"ב`), other sources use
 * ISO codes. `formatCurrency` knows both, and its nullable form returns null for a label it
 * does not recognize rather than throwing — a security whose currency cannot be resolved is
 * still worth having, with the column left empty.
 *
 * The guard matters: `formatCurrency` reads a *missing* label as ILS, which would stamp every
 * security that reports no currency as a shekel one.
 */
function toCurrency(rawCurrency: string | null | undefined): Currency | null {
  const label = rawCurrency?.trim();
  return label ? formatCurrency(label, true) : null;
}

export type IdentifierKey = {
  type: SecurityIdentifierType;
  value: string;
};

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class SecurityBusinessesProvider {
  constructor(
    private db: TenantAwareDBClient,
    private adminContextProvider: AdminContextProvider,
    private financialEntitiesProvider: FinancialEntitiesProvider,
    private businessesProvider: BusinessesProvider,
    private taxCategoriesProvider: TaxCategoriesProvider,
  ) {}

  private async batchSecurityBusinessesByIds(ids: readonly string[]) {
    const rows = await getSecurityBusinessesByIds.run({ ids: [...new Set(ids)] }, this.db);
    const byId = new Map(rows.map(row => [row.id, row]));
    return ids.map(id => byId.get(id) ?? null);
  }

  public getSecurityBusinessByIdLoader = new DataLoader((ids: readonly string[]) =>
    this.batchSecurityBusinessesByIds(ids),
  );

  private allSecurityBusinessesPromise: Promise<SecurityBusinessRow[]> | null = null;

  /**
   * Every security business of the acting tenant. Cached per request because charge typing and
   * account resolution ask for it on every transaction they touch.
   */
  public getAllSecurityBusinesses(): Promise<SecurityBusinessRow[]> {
    this.allSecurityBusinessesPromise ??= getAllSecurityBusinesses
      .run(undefined, this.db)
      .then(rows => {
        rows.map(row => this.getSecurityBusinessByIdLoader.prime(row.id, row));
        return rows;
      });
    return this.allSecurityBusinessesPromise;
  }

  public async getAllSecurityBusinessIds(): Promise<Set<string>> {
    const rows = await this.getAllSecurityBusinesses();
    return new Set(rows.map(row => row.id));
  }

  public async isSecurityBusiness(businessId: string): Promise<boolean> {
    return (await this.getAllSecurityBusinessIds()).has(businessId);
  }

  private async batchSecurityBusinessesByIdentifiers(keys: readonly IdentifierKey[]) {
    // One query per identifier type; in practice a batch carries a single type.
    const valuesByType = new Map<SecurityIdentifierType, Set<string>>();
    for (const key of keys) {
      const values = valuesByType.get(key.type);
      if (values) {
        values.add(key.value);
      } else {
        valuesByType.set(key.type, new Set([key.value]));
      }
    }

    const found = new Map<string, SecurityBusinessRow>();
    await Promise.all(
      [...valuesByType].map(async ([identifierType, values]) => {
        const rows = await getSecurityBusinessesByIdentifiers.run(
          { identifierType, identifierValues: [...values] },
          this.db,
        );
        for (const { identifier_value, ...securityBusiness } of rows) {
          found.set(`${identifierType}:${identifier_value}`, securityBusiness);
        }
      }),
    );

    return keys.map(key => found.get(`${key.type}:${key.value}`) ?? null);
  }

  public getSecurityBusinessByIdentifierLoader = new DataLoader(
    (keys: readonly IdentifierKey[]) => this.batchSecurityBusinessesByIdentifiers(keys),
    { cacheKeyFn: key => `${key.type}:${key.value}` },
  );

  private async batchIdentifiersByBusinessIds(businessIds: readonly string[]) {
    const rows = await getSecurityIdentifiersByBusinessIds.run(
      { businessIds: [...new Set(businessIds)] },
      this.db,
    );
    const byBusinessId = new Map<string, SecurityIdentifierRow[]>();
    for (const row of rows) {
      const group = byBusinessId.get(row.business_id);
      if (group) {
        group.push(row);
      } else {
        byBusinessId.set(row.business_id, [row]);
      }
    }
    return businessIds.map(businessId => byBusinessId.get(businessId) ?? []);
  }

  public getIdentifiersByBusinessIdLoader = new DataLoader((businessIds: readonly string[]) =>
    this.batchIdentifiersByBusinessIds(businessIds),
  );

  /** The security businesses already created for these ISINs, keyed by ISIN. */
  public async getSecurityBusinessesByIsins(
    isins: readonly string[],
  ): Promise<Map<string, SecurityBusinessRow>> {
    if (isins.length === 0) {
      return new Map();
    }
    const rows = await getSecurityBusinessesByIsins.run({ isins: [...new Set(isins)] }, this.db);
    rows.map(row => this.getSecurityBusinessByIdLoader.prime(row.id, row));
    return new Map(rows.map(row => [row.isin, row]));
  }

  private async getSecurityBusinessByIsin(isin: string): Promise<SecurityBusinessRow | null> {
    return (await this.getSecurityBusinessesByIsins([isin])).get(isin) ?? null;
  }

  /**
   * The business a security is represented by, creating it on first sight.
   *
   * Idempotent by ISIN: concurrent ingests race on the (owner_id, isin) unique index, and the
   * loser rolls its whole transaction back — financial entity and business included — then
   * re-reads the winner's row, so a race can't leave a half-built business behind.
   *
   * Sort code, IRS code, country and tax category are inherited from the tenant's general
   * foreign-securities business, so a security behaves like it everywhere those fields drive
   * reporting.
   */
  public async ensureSecurityBusiness(
    descriptors: SecurityBusinessDescriptors,
  ): Promise<SecurityBusinessRow> {
    const existing = await this.getSecurityBusinessByIsin(descriptors.isin);
    if (existing) {
      return existing;
    }

    const adminContext = await this.adminContextProvider.getVerifiedAdminContext();
    const { ownerId } = adminContext;
    const generalBusinessId = adminContext.foreignSecurities.foreignSecuritiesBusinessId;

    const [generalBusiness, generalTaxCategory] = await Promise.all([
      generalBusinessId
        ? this.businessesProvider.getBusinessByIdLoader.load(generalBusinessId)
        : null,
      generalBusinessId
        ? this.taxCategoriesProvider.taxCategoryByBusinessIDsLoader.load(generalBusinessId)
        : null,
    ]);

    try {
      const created = await this.db.transaction(async client => {
        const [financialEntity] = await this.financialEntitiesProvider.insertFinancialEntity(
          {
            ownerId,
            name: buildSecurityBusinessName(descriptors),
            sortCode: generalBusiness?.sort_code ?? null,
            type: 'business',
            irsCode: generalBusiness?.irs_code ?? null,
            isActive: true,
          },
          client,
        );
        if (!financialEntity) {
          throw new Error(
            `Failed to create financial entity for security ISIN="${descriptors.isin}"`,
          );
        }

        const business = await this.businessesProvider.insertBusiness(
          {
            id: financialEntity.id,
            ownerId,
            // businesses.country is NOT NULL and FK'd to countries.code, so it can never be
            // passed as null; ISR is the column's own default.
            country: generalBusiness?.country ?? 'ISR',
            hebrewName: descriptors.hebName?.trim() || null,
            // A security has no contact details, VAT number or document expectations of its
            // own; the columns are spelled out because the insert takes a full tuple.
            address: null,
            city: null,
            zipCode: null,
            email: null,
            website: null,
            phoneNumber: null,
            governmentId: null,
            exemptDealer: false,
            optionalVat: false,
            isReceiptEnough: false,
            isDocumentsOptional: false,
            pcn874RecordTypeOverride: null,
            // No phrases: a security must never win a description-based suggestion.
            suggestions: null,
          },
          client,
        );
        if (!business) {
          throw new Error(`Failed to create business for security ISIN="${descriptors.isin}"`);
        }

        // Last on purpose: the unique index on (owner_id, isin) is what arbitrates the race,
        // and everything above it is rolled back when this insert loses.
        const [securityBusiness] = await insertSecurityBusiness.run(
          {
            id: financialEntity.id,
            ownerId,
            isin: descriptors.isin,
            symbol: descriptors.symbol?.trim() || null,
            engName: descriptors.engName?.trim() || null,
            hebName: descriptors.hebName?.trim() || null,
            exchange: descriptors.exchange?.trim() || null,
            currencyCode: toCurrency(descriptors.currencyCode),
            itemType: descriptors.itemType ?? null,
            stockType: descriptors.stockType ?? null,
            isEtf: descriptors.isEtf ?? null,
            isForeign: descriptors.isForeign ?? null,
            issuerCountryCode: descriptors.issuerCountryCode ?? null,
          },
          client,
        );
        if (!securityBusiness) {
          throw new Error(`Failed to create security record for ISIN="${descriptors.isin}"`);
        }

        if (generalTaxCategory) {
          await this.taxCategoriesProvider.insertBusinessTaxCategory({
            businessId: financialEntity.id,
            ownerId,
            taxCategoryId: generalTaxCategory.id,
          });
        }

        return securityBusiness;
      });

      this.clearCache();
      return created;
    } catch (error) {
      const winner = await this.getSecurityBusinessByIsin(descriptors.isin);
      if (winner) {
        return winner;
      }
      throw error;
    }
  }

  public async linkIdentifier(
    businessId: string,
    identifierType: SecurityIdentifierType,
    identifierValue: string,
  ): Promise<void> {
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    await insertSecurityIdentifier.run(
      { ownerId, businessId, identifierType, identifierValue },
      this.db,
    );
    this.getSecurityBusinessByIdentifierLoader.clear({
      type: identifierType,
      value: identifierValue,
    });
    this.getIdentifiersByBusinessIdLoader.clear(businessId);
  }

  public clearCache() {
    this.allSecurityBusinessesPromise = null;
    this.getSecurityBusinessByIdLoader.clearAll();
    this.getSecurityBusinessByIdentifierLoader.clearAll();
    this.getIdentifiersByBusinessIdLoader.clearAll();
  }
}
