import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
// eslint-disable-next-line no-restricted-imports
import type { PoolClient } from 'pg';
import { sql } from '@pgtyped/runtime';
import { reassureOwnerIdExists } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IGetAllBusinessesQuery,
  IGetAllBusinessesResult,
  IGetBusinessByEmailQuery,
  IGetBusinessesByFiltersParams,
  IGetBusinessesByFiltersQuery,
  IGetBusinessesByIdsQuery,
  IInsertBusinessesParams,
  IInsertBusinessesQuery,
  IReplaceBusinessesQuery,
  IUpdateBusinessParams,
  IUpdateBusinessQuery,
} from '../types.js';

const getBusinessesByIds = sql<IGetBusinessesByIdsQuery>`
    SELECT fe.*, b.vat_number, b.hebrew_name, b.address, b.address_hebrew, b.email, b.website, b.phone_number, b.country, b.no_invoices_required, b.suggestion_data, b.can_settle_with_receipt, b.exempt_dealer, b.optional_vat, b.pcn874_record_type_override, b.city, b.zip_code
    FROM accounter_schema.businesses b
    INNER JOIN accounter_schema.financial_entities fe
      USING (id)
    WHERE b.id IN $$ids;`;

const getAllBusinesses = sql<IGetAllBusinessesQuery>`
    SELECT fe.*, b.vat_number, b.hebrew_name, b.address, b.address_hebrew, b.email, b.website, b.phone_number, b.country, b.no_invoices_required, b.suggestion_data, b.can_settle_with_receipt, b.exempt_dealer, b.optional_vat, b.pcn874_record_type_override, b.city, b.zip_code
    FROM accounter_schema.businesses b
    INNER JOIN accounter_schema.financial_entities fe
      USING (id);`;

// Every predicate is optional: a null scalar or a zero `is*` flag short-circuits it. The tax
// category and sort code predicates each OR a list match with a "has none" match, so a caller can
// ask for "category X or uncategorized" in one go. The EXISTS sub-queries carry no owner predicate
// of their own: RLS already scopes every joined table to the current business scope, which is also
// how the `taxCategory` / `isClient` / `isAdmin` field resolvers read them. `strpos` rather than
// ILIKE keeps user-typed `%` / `_` literal.
const getBusinessesByFilters = sql<IGetBusinessesByFiltersQuery>`
    SELECT fe.*, b.vat_number, b.hebrew_name, b.address, b.address_hebrew, b.email, b.website, b.phone_number, b.country, b.no_invoices_required, b.suggestion_data, b.can_settle_with_receipt, b.exempt_dealer, b.optional_vat, b.pcn874_record_type_override, b.city, b.zip_code
    FROM accounter_schema.businesses b
    INNER JOIN accounter_schema.financial_entities fe
      USING (id)
    WHERE ($name::TEXT IS NULL
        OR strpos(lower(fe.name), lower($name::TEXT)) > 0
        OR strpos(lower(b.hebrew_name), lower($name::TEXT)) > 0)
      AND (($isTaxCategoryIds = 0 AND $withoutTaxCategory::BOOLEAN IS NOT TRUE)
        OR ($isTaxCategoryIds = 1 AND EXISTS (
          SELECT 1
          FROM accounter_schema.business_tax_category_match tcm
          WHERE tcm.business_id = b.id
            AND tcm.tax_category_id IN $$taxCategoryIds
        ))
        OR ($withoutTaxCategory::BOOLEAN IS TRUE AND NOT EXISTS (
          SELECT 1
          FROM accounter_schema.business_tax_category_match tcm
          WHERE tcm.business_id = b.id
        )))
      AND (($isSortCodes = 0 AND $withoutSortCode::BOOLEAN IS NOT TRUE)
        OR ($isSortCodes = 1 AND fe.sort_code IN $$sortCodes)
        OR ($withoutSortCode::BOOLEAN IS TRUE AND fe.sort_code IS NULL))
      AND ($isCountries = 0 OR b.country IN $$countries)
      AND ($isClient::BOOLEAN IS NULL OR EXISTS (
        SELECT 1
        FROM accounter_schema.clients c
        WHERE c.business_id = b.id
      ) = $isClient::BOOLEAN)
      AND ($isActive::BOOLEAN IS NULL OR fe.is_active = $isActive::BOOLEAN)
      AND ($isAdmin::BOOLEAN IS NULL OR EXISTS (
        SELECT 1
        FROM accounter_schema.businesses_admin ba
        WHERE ba.id = b.id
      ) = $isAdmin::BOOLEAN);`;

// Match a business by a recognition email in suggestion_data.emails. A stored
// entry may be a wildcard pattern (e.g. `*@cloudflare.com`) for suppliers that
// send from a unique address per invoice: `*` is translated to a LIKE wildcard
// while the LIKE metacharacters `%` and `_` are escaped, so a literal entry
// still matches exactly. Matching is case-insensitive. `#` is used as the LIKE
// ESCAPE character (and is itself escaped as `##`) instead of the default
// backslash, so the query text carries no backslashes: pgtyped emits the
// template verbatim, and a doubled backslash would otherwise reach Postgres as a
// two-character escape string ("invalid escape string"). See
// email-pattern.helper.ts for the equivalent in-process matcher; the
// jsonb_typeof guard keeps jsonb_array_elements_text from throwing on a
// malformed/legacy record whose `emails` is not a JSON array.
const getBusinessByEmail = sql<IGetBusinessByEmailQuery>`
    SELECT fe.*, b.vat_number, b.hebrew_name, b.address, b.address_hebrew, b.email, b.website, b.phone_number, b.country, b.no_invoices_required, b.suggestion_data, b.can_settle_with_receipt, b.exempt_dealer, b.optional_vat, b.pcn874_record_type_override, b.city, b.zip_code
    FROM accounter_schema.businesses b
    INNER JOIN accounter_schema.financial_entities fe
      USING (id)
    WHERE EXISTS (
      SELECT 1
        FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(b.suggestion_data->'emails') = 'array'
               THEN b.suggestion_data->'emails'
               ELSE '[]'::jsonb
          END
        ) AS candidate
       WHERE lower($email::text) LIKE
         replace(replace(replace(replace(lower(candidate), '#', '##'), '%', '#%'), '_', '#_'), '*', '%')
         ESCAPE '#'
    )
    LIMIT 1;`;

const updateBusiness = sql<IUpdateBusinessQuery>`
  UPDATE accounter_schema.businesses
  SET
  vat_number = COALESCE(
    $vatNumber,
    vat_number
  ),
  hebrew_name = COALESCE(
    $hebrewName,
    hebrew_name
  ),
  address = COALESCE(
    $address,
    address
  ),
  city = COALESCE(
    $city,
    city
  ),
  zip_code = COALESCE(
    $zipCode,
    zip_code
  ),
  address_hebrew = COALESCE(
    $addressHebrew,
    address_hebrew
  ),
  email = COALESCE(
    $email,
    email
  ),
  website = COALESCE(
    $website,
    website
  ),
  phone_number = COALESCE(
    $phoneNumber,
    phone_number
  ),
  country = COALESCE(
    $country,
    country
  ),
  no_invoices_required = COALESCE(
    $isDocumentsOptional,
    no_invoices_required
  ),
  suggestion_data = COALESCE(
    $suggestionData,
    suggestion_data
  ),
  can_settle_with_receipt = COALESCE(
    $isReceiptEnough,
    can_settle_with_receipt
  ),
  exempt_dealer = COALESCE(
    $exemptDealer,
    exempt_dealer
  ),
  optional_vat = COALESCE(
    $optionalVat,
    optional_vat
  ),
  pcn874_record_type_override = COALESCE(
    $pcn874RecordTypeOverride,
    pcn874_record_type_override
  )
  WHERE
    id = $businessId
  RETURNING *;
`;

const insertBusinesses = sql<IInsertBusinessesQuery>`
  INSERT INTO accounter_schema.businesses (id, hebrew_name, address, city, zip_code, email, website, phone_number, vat_number, exempt_dealer, suggestion_data, optional_vat, country, pcn874_record_type_override, can_settle_with_receipt, no_invoices_required, owner_id)
  VALUES $$businesses(id, hebrewName, address, city, zipCode, email, website, phoneNumber, governmentId, exemptDealer, suggestions, optionalVat, country, pcn874RecordTypeOverride, isReceiptEnough, isDocumentsOptional, ownerId)
  RETURNING *;`;

const replaceBusinesses = sql<IReplaceBusinessesQuery>`
  WITH ledger_debit1 AS (
    UPDATE accounter_schema.ledger_records
    SET debit_entity1 = $targetBusinessId
    WHERE debit_entity1 = $businessIdToReplace
    RETURNING id
  ),
  ledger_debit2 AS (
    UPDATE accounter_schema.ledger_records
    SET debit_entity2 = $targetBusinessId
    WHERE debit_entity2 = $businessIdToReplace
    RETURNING id
  ),
  ledger_credit1 AS (
    UPDATE accounter_schema.ledger_records
    SET credit_entity1 = $targetBusinessId
    WHERE credit_entity1 = $businessIdToReplace
    RETURNING id
  ),
  ledger_credit2 AS (
    UPDATE accounter_schema.ledger_records
    SET credit_entity2 = $targetBusinessId
    WHERE credit_entity2 = $businessIdToReplace
    RETURNING id
  ),
  documents_debtor AS (
    UPDATE accounter_schema.documents
    SET debtor_id = $targetBusinessId
    WHERE debtor_id = $businessIdToReplace
    RETURNING id
  ),
  documents_creditor AS (
    UPDATE accounter_schema.documents
    SET creditor_id = $targetBusinessId
    WHERE creditor_id = $businessIdToReplace
    RETURNING id
  ),
  employees AS (
    UPDATE accounter_schema.employees
    SET business_id = $targetBusinessId
    WHERE business_id = $businessIdToReplace
    RETURNING business_id
  ),
  funds AS (
    UPDATE accounter_schema.pension_funds
    SET id = $targetBusinessId
    WHERE id = $businessIdToReplace
    RETURNING id
  ),
  business_trips_attendees AS (
    UPDATE accounter_schema.business_trips_attendees
    SET attendee_business_id = $targetBusinessId
    WHERE attendee_business_id = $businessIdToReplace
    RETURNING business_trip_id
  ),
  business_trips_employee_payments AS (
    UPDATE accounter_schema.business_trips_employee_payments
    SET employee_business_id = $targetBusinessId
    WHERE employee_business_id = $businessIdToReplace
    RETURNING id
  ),
  charge_unbalanced_ledger_businesses AS (
    UPDATE accounter_schema.charge_unbalanced_ledger_businesses
    SET business_id = $targetBusinessId
    WHERE business_id = $businessIdToReplace
    RETURNING charge_id
  ),
  charge_balance_cancellation AS (
    UPDATE accounter_schema.charge_balance_cancellation
    SET business_id = $targetBusinessId
    WHERE business_id = $businessIdToReplace
    RETURNING charge_id
  ),
  dividends AS (
    UPDATE accounter_schema.dividends
    SET business_id = $targetBusinessId
    WHERE business_id = $businessIdToReplace
    RETURNING id
  ),
  corporate_tax_variables as (
    UPDATE accounter_schema.corporate_tax_variables
    SET corporate_id = $targetBusinessId
    WHERE corporate_id = $businessIdToReplace
    RETURNING date
  ),
  clients AS (
    UPDATE accounter_schema.clients
    SET business_id = $targetBusinessId
    WHERE business_id = $businessIdToReplace
    RETURNING (integrations->>'greenInvoiceId')::uuid
  ),
  -- Only when the target is itself a security business: the FK points at
  -- businesses_securities, and the merged security row (plus any identifier left behind
  -- here) is cascaded away with it. The unique index on
  -- (owner_id, identifier_type, identifier_value) already rules out a collision.
  security_identifiers AS (
    UPDATE accounter_schema.security_identifiers
    SET business_id = $targetBusinessId
    WHERE business_id = $businessIdToReplace
      AND EXISTS (
        SELECT 1
        FROM accounter_schema.businesses_securities
        WHERE id = $targetBusinessId
      )
    RETURNING id
  )
  UPDATE accounter_schema.transactions
  SET business_id = $targetBusinessId
  WHERE business_id = $businessIdToReplace
  RETURNING id;
`;

export type BusinessesFiltersParams = {
  name?: string | null;
  taxCategoryIds?: readonly string[] | null;
  withoutTaxCategory?: boolean | null;
  sortCodes?: readonly number[] | null;
  withoutSortCode?: boolean | null;
  countries?: readonly string[] | null;
  isClient?: boolean | null;
  isActive?: boolean | null;
  isAdmin?: boolean | null;
};

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class BusinessesProvider {
  constructor(
    private db: TenantAwareDBClient,
    private adminContextProvider: AdminContextProvider,
  ) {}

  private async batchBusinessesByIds(ids: readonly string[]) {
    const uniqueIds = [...new Set(ids)];
    const businesses = await getBusinessesByIds.run(
      {
        ids: uniqueIds,
      },
      this.db,
    );
    return ids.map(id => businesses.find(fe => fe.id === id));
  }

  public getBusinessByIdLoader = new DataLoader((ids: readonly string[]) =>
    this.batchBusinessesByIds(ids),
  );

  private allBusinessesCache: Promise<IGetAllBusinessesResult[]> | null = null;
  public getAllBusinesses() {
    if (this.allBusinessesCache) {
      return this.allBusinessesCache;
    }
    this.allBusinessesCache = getAllBusinesses.run(undefined, this.db).then(businesses => {
      businesses.map(business => {
        this.getBusinessByIdLoader.prime(business.id, business);
      });
      return businesses;
    });
    return this.allBusinessesCache;
  }

  public getBusinessesByFilters(params: BusinessesFiltersParams) {
    const name = params.name?.trim() || null;
    const taxCategoryIds = params.taxCategoryIds?.filter(Boolean) ?? [];
    const sortCodes = params.sortCodes?.filter(code => code != null) ?? [];
    // The CountryCode scalar matches case-insensitively, while the column holds upper-case codes.
    const countries = params.countries?.filter(Boolean).map(code => code.toUpperCase()) ?? [];

    const fullParams: IGetBusinessesByFiltersParams = {
      name,
      // pgtyped requires a non-empty array for `IN $$list`; the matching `is*` flag
      // short-circuits the predicate, so the placeholder is never compared.
      isTaxCategoryIds: taxCategoryIds.length ? 1 : 0,
      taxCategoryIds: taxCategoryIds.length ? [...taxCategoryIds] : [null],
      withoutTaxCategory: params.withoutTaxCategory ?? null,
      isSortCodes: sortCodes.length ? 1 : 0,
      sortCodes: sortCodes.length ? [...sortCodes] : [null],
      withoutSortCode: params.withoutSortCode ?? null,
      isCountries: countries.length ? 1 : 0,
      countries: countries.length ? countries : [null],
      isClient: params.isClient ?? null,
      isActive: params.isActive ?? null,
      isAdmin: params.isAdmin ?? null,
    };

    return getBusinessesByFilters.run(fullParams, this.db).then(businesses => {
      for (const business of businesses) {
        this.getBusinessByIdLoader.prime(business.id, business);
      }
      return businesses;
    });
  }

  public getBusinessByEmail(email: string) {
    return getBusinessByEmail.run({ email }, this.db).then(res => {
      if (res?.length) {
        res.map(business => {
          this.getBusinessByIdLoader.prime(business.id, business);
        });
        return res[0];
      }
      return null;
    });
  }

  public async updateBusiness(
    params: Omit<IUpdateBusinessParams, 'businessId'> & { businessId: string },
  ) {
    if (params.businessId) await this.invalidateBusinessById(params.businessId);
    return updateBusiness.run(params, this.db);
  }

  private async batchInsertBusinesses(
    newBusinesses: readonly IInsertBusinessesParams['businesses'][number][],
  ) {
    await Promise.all(
      newBusinesses.map(async nb => {
        if (nb.id) {
          await this.invalidateBusinessById(nb.id);
        }
      }),
    );
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    const businessesWithOwnerId = newBusinesses.map(business =>
      reassureOwnerIdExists(business, ownerId),
    );
    const businesses = await insertBusinesses.run(
      {
        businesses: businessesWithOwnerId,
      },
      this.db,
    );
    return newBusinesses.map(nb => businesses.find(b => b.id === nb.id) ?? null);
  }

  public insertBusinessLoader = new DataLoader(
    (businesses: readonly IInsertBusinessesParams['businesses'][number][]) =>
      this.batchInsertBusinesses(businesses),
    {
      cache: false,
    },
  );

  public async insertBusiness(
    newBusiness: IInsertBusinessesParams['businesses'][number],
    client?: PoolClient,
  ) {
    if (newBusiness.id) {
      await this.invalidateBusinessById(newBusiness.id);
    }
    const ownerId =
      newBusiness.ownerId ?? (await this.adminContextProvider.getVerifiedAdminContext()).ownerId;
    const businessWithOwnerId = reassureOwnerIdExists(newBusiness, ownerId);
    const businesses = await insertBusinesses.run(
      {
        businesses: [businessWithOwnerId],
      },
      client ?? this.db,
    );
    return businesses[0];
  }

  public async replaceBusiness(targetBusinessId: string, businessIdToReplace: string) {
    const [businessToReplace, business] = await Promise.all([
      this.getBusinessByIdLoader.load(businessIdToReplace),
      this.getBusinessByIdLoader.load(targetBusinessId),
    ]);
    if (!businessToReplace) {
      throw new Error(`Business with id ${businessIdToReplace} not found`);
    }
    if (!business) {
      throw new Error(`Business with id ${targetBusinessId} not found`);
    }
    this.invalidateBusinessById(businessIdToReplace);
    this.invalidateBusinessById(targetBusinessId);

    // convert transactions, ledger, documents, employees, funds, business trips attendees, business trips employee payments, charge unbalanced ledger businesses, charge balance cancellation, dividends, corporate tax variables, businesses green invoice match
    await replaceBusinesses.run(
      {
        targetBusinessId,
        businessIdToReplace,
      },
      this.db,
    );

    // TODO: convert when owner: financial entities, charges, business-tax-category, ledger

    // TODO: should convert business tax category matches?
  }

  public async invalidateBusinessById(businessId: string) {
    this.getBusinessByIdLoader.clear(businessId);
    this.allBusinessesCache = null;
  }

  public clearCache() {
    this.getBusinessByIdLoader.clearAll();
    this.allBusinessesCache = null;
  }
}
