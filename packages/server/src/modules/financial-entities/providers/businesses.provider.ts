import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import { suggestionDataSchema } from '../helpers/business-suggestion-data-schema.helper.js';
import type {
  IGetAllBusinessesQuery,
  IGetAllBusinessesResult,
  IGetBusinessByEmailQuery,
  IGetBusinessByEmailResult,
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
  tax_siduri_number_2021 = COALESCE(
    $taxSiduriNumber2021,
    tax_siduri_number_2021
  ),
  password = COALESCE(
    $password,
    password
  ),
  username_vat_website = COALESCE(
    $usernameVatWebsite,
    username_vat_website
  ),
  website_login_screenshot = COALESCE(
    $websiteLoginScreenshot,
    website_login_screenshot
  ),
  nikuim = COALESCE(
    $nikuim,
    nikuim
  ),
  pinkas_social_security_2021 = COALESCE(
    $pinkasSocialSecurity2021,
    pinkas_social_security_2021
  ),
  hebrew_name = COALESCE(
    $hebrewName,
    hebrew_name
  ),
  tax_pinkas_number_2020 = COALESCE(
    $taxPinkasNumber2020,
    tax_pinkas_number_2020
  ),
  address = COALESCE(
    $address,
    address
  ),
  address_hebrew = COALESCE(
    $addressHebrew,
    address_hebrew
  ),
  wizcloud_token = COALESCE(
    $wizcloudToken,
    wizcloud_token
  ),
  wizcloud_company_id = COALESCE(
    $wizcloudCompany_id,
    wizcloud_company_id
  ),
  advance_tax_rate = COALESCE(
    $advanceTaxRate,
    advance_tax_rate
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
  bank_account_bank_number = COALESCE(
    $bankAccountBankNumber,
    bank_account_bank_number
  ),
  bank_account_branch_number = COALESCE(
    $bankAccountBranchNumber,
    bank_account_branch_number
  ),
  bank_account_account_number = COALESCE(
    $bankAccountAccountNumber,
    bank_account_account_number
  ),
  "bank_account_IBAN"  = COALESCE(
    $bankAccountIBAN,
    "bank_account_IBAN"
  ),
  tax_nikuim_pinkas_number = COALESCE(
    $taxNikuimPinkasNumber,
    tax_nikuim_pinkas_number
  ),
  bank_account_swift = COALESCE(
    $bankAccountSwift,
    bank_account_swift
  ),
  vat_report_cadence = COALESCE(
    $vatReportCadence,
    vat_report_cadence
  ),
  contract = COALESCE(
    $contract,
    contract
  ),
  country = COALESCE(
    $country,
    country
  ),
  pinkas_social_security_2022 = COALESCE(
    $pinkasSocialSecurity2022,
    pinkas_social_security_2022
  ),
  tax_siduri_number_2022 = COALESCE(
    $taxSiduriNumber2022,
    tax_siduri_number_2022
  ),
  registration_date = COALESCE(
    $registrationDate,
    registration_date
  ),
  no_invoices_required = COALESCE(
    $noInvoicesRequired,
    no_invoices_required
  ),
  suggestion_data = COALESCE(
    $suggestionData,
    suggestion_data
  ),
  can_settle_with_receipt = COALESCE(
    $canSettleWithReceipt,
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
  INSERT INTO accounter_schema.businesses (id, hebrew_name, address, email, website, phone_number, vat_number, exempt_dealer, suggestion_data, optional_vat, country, pcn874_record_type_override)
  VALUES $$businesses(id, hebrewName, address, email, website, phoneNumber, governmentId, exemptDealer, suggestions, optionalVat, country, pcn874RecordTypeOverride)
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
    RETURNING green_invoice_id
  )
  UPDATE accounter_schema.transactions
  SET business_id = $targetBusinessId
  WHERE business_id = $businessIdToReplace
  RETURNING id;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchBusinessesByIds(ids: readonly string[]) {
    const uniqueIds = [...new Set(ids)];
    const businesses = await getBusinessesByIds.run(
      {
        ids: uniqueIds,
      },
      this.dbProvider,
    );
    return ids.map(id => businesses.find(fe => fe.id === id));
  }

  public getBusinessByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessesByIds(ids),
    {
      cacheKeyFn: id => `business-${id}`,
      cacheMap: this.cache,
    },
  );

  public getAllBusinesses() {
    const data = this.cache.get<IGetAllBusinessesResult[]>('all-businesses');
    if (data) {
      return Promise.resolve(data);
    }
    return getAllBusinesses.run(undefined, this.dbProvider);
  }

  public getBusinessByEmail(email: string) {
    const cacheKey = `business-email-${email}`;
    const cachedData = this.cache.get<IGetBusinessByEmailResult | null>(cacheKey);
    if (cachedData !== undefined) {
      return Promise.resolve(cachedData);
    }
    return getBusinessByEmail.run({ email }, this.dbProvider).then(res => {
      const business = res?.length ? res[0] : null;
      this.cache.set(cacheKey, business);
      return business;
    });
  }

  public async updateBusiness(
    params: Omit<IUpdateBusinessParams, 'businessId'> & { businessId: string },
  ) {
    if (params.businessId) await this.invalidateBusinessById(params.businessId);
    return updateBusiness.run(params, this.dbProvider);
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
      this.dbProvider,
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
      this.dbProvider,
    );

    // TODO: convert when owner: financial entities, charges, business-tax-category, ledger

    // TODO: should convert business tax category matches?
  }

  public async invalidateBusinessById(businessId: string) {
    const business = await this.getBusinessByIdLoader.load(businessId);
    if (business?.suggestion_data) {
      const { data: suggestionData } = suggestionDataSchema.safeParse(business.suggestion_data);
      if (suggestionData?.emails) {
        for (const email of suggestionData.emails) {
          this.cache.delete(`business-email-${email}`);
        }
      }
    }
    this.cache.delete('all-businesses');
    this.cache.delete(`business-${businessId}`);
  }

  public clearCache() {
    this.cache.clear();
  }
}
