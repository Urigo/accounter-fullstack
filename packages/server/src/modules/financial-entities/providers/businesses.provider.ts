import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IGetAllBusinessesQuery,
  IGetAllBusinessesResult,
  IGetBusinessesByIdsQuery,
  IInsertBusinessParams,
  IInsertBusinessQuery,
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
  )
  WHERE
    id = $businessId
  RETURNING *;
`;

const insertBusiness = sql<IInsertBusinessQuery>`
  INSERT INTO accounter_schema.businesses (id, hebrew_name, address, email, website, phone_number, vat_number, exempt_dealer, suggestion_data, optional_vat)
  VALUES($id, $hebrewName, $address, $email, $website, $phoneNumber, $governmentId, $exemptDealer, $suggestions, $optionalVat)
  RETURNING *;`;

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

  public async updateBusiness(params: IUpdateBusinessParams) {
    if (params.businessId) await this.invalidateBusinessById(params.businessId);
    return updateBusiness.run(params, this.dbProvider);
  }

  public insertBusiness(params: IInsertBusinessParams) {
    this.cache.delete('all-businesses');
    return insertBusiness.run(params, this.dbProvider);
  }

  public async invalidateBusinessById(businessId: string) {
    this.cache.delete('all-businesses');
    this.cache.delete(`business-${businessId}`);
  }

  public clearCache() {
    this.cache.clear();
  }
}
