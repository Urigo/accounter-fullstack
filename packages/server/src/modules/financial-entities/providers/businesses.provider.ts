import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IGetAllBusinessesQuery,
  IGetAllBusinessesResult,
  IGetBusinessByEmailQuery,
  IGetBusinessesByIdsQuery,
  IInsertBusinessesParams,
  IInsertBusinessesQuery,
  IReplaceBusinessesQuery,
  IUpdateBusinessParams,
  IUpdateBusinessQuery,
} from '../types.js';

const getBusinessesByIds = sql<IGetBusinessesByIdsQuery>`
    SELECT *
    FROM accounter_schema.businesses b
    INNER JOIN accounter_schema.financial_entities fe
      USING (id)
    WHERE b.id IN $$ids;`;

const getAllBusinesses = sql<IGetAllBusinessesQuery>`
    SELECT *
    FROM accounter_schema.businesses b
    INNER JOIN accounter_schema.financial_entities fe
      USING (id);`;

const getBusinessByEmail = sql<IGetBusinessByEmailQuery>`
    SELECT *
    FROM accounter_schema.businesses b
    INNER JOIN accounter_schema.financial_entities fe
      USING (id)
    WHERE
      suggestion_data->'emails' ? $email::text
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
  INSERT INTO accounter_schema.businesses (id, hebrew_name, address, city, zip_code, email, website, phone_number, vat_number, exempt_dealer, suggestion_data, optional_vat, country, pcn874_record_type_override, can_settle_with_receipt, no_invoices_required)
  VALUES $$businesses(id, hebrewName, address, city, zipCode, email, website, phoneNumber, governmentId, exemptDealer, suggestions, optionalVat, country, pcn874RecordTypeOverride, isReceiptEnough, isDocumentsOptional)
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
  )
  UPDATE accounter_schema.transactions
  SET business_id = $targetBusinessId
  WHERE business_id = $businessIdToReplace
  RETURNING id;
`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class BusinessesProvider {
  constructor(private db: TenantAwareDBClient) {}

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
    const businesses = await insertBusinesses.run(
      {
        businesses: newBusinesses,
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
