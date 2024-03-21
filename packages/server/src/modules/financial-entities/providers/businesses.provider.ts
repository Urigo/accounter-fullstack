import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllBusinessesQuery,
  IGetBusinessesByChargeIdsParams,
  IGetBusinessesByChargeIdsQuery,
  IGetBusinessesByIdsQuery,
  IGetBusinessesByNamesQuery,
  IUpdateBusinessParams,
  IUpdateBusinessQuery,
} from '../types.js';

const getBusinessesByIds = sql<IGetBusinessesByIdsQuery>`
    SELECT *
    FROM accounter_schema.businesses b
    INNER JOIN accounter_schema.financial_entities fe
      USING (id)
    WHERE b.id IN $$ids;`;

const getBusinessesByNames = sql<IGetBusinessesByNamesQuery>`
    SELECT *
    FROM accounter_schema.businesses b
    INNER JOIN accounter_schema.financial_entities fe
      USING (id)
    WHERE fe.name IN $$names;`;

const getAllBusinesses = sql<IGetAllBusinessesQuery>`
    SELECT *
    FROM accounter_schema.businesses b
    INNER JOIN accounter_schema.financial_entities fe
      USING (id);`;

const getBusinessesByChargeIds = sql<IGetBusinessesByChargeIdsQuery>`
    SELECT c.id as charge_id, fe.*,
      b.address,
      b.address_hebrew,
      b.advance_tax_rate,
      b.bank_account_account_number,
      b.bank_account_bank_number,
      b.bank_account_branch_number,
      b."bank_account_IBAN",
      b.bank_account_swift,
      b.can_settle_with_receipt,
      b.contract,
      b.country,
      b.email,
      b.exempt_dealer,
      b.hebrew_name,
      b.nikuim,
      b.no_invoices_required,
      b.password,
      b.phone_number,
      b.pinkas_social_security_2021,
      b.pinkas_social_security_2022,
      b.registration_date,
      b.suggestion_data,
      b.tax_nikuim_pinkas_number,
      b.tax_pinkas_number_2020,
      b.tax_siduri_number_2021,
      b.tax_siduri_number_2022,
      b.username_vat_website,
      b.vat_number,
      b.vat_report_cadence,
      b.website,
      b.website_login_screenshot,
      b.wizcloud_company_id,
      b.wizcloud_token
    FROM accounter_schema.charges c
    LEFT JOIN accounter_schema.businesses b
      ON  c.owner_id = b.id
    LEFT JOIN accounter_schema.financial_entities fe
      ON b.id = fe.id
    WHERE c.id IN $$chargeIds;`;

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
  )
  WHERE
    id = $businessId
  RETURNING *;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessesProvider {
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
    (keys: readonly string[]) => this.batchBusinessesByIds(keys),
    {
      cache: false,
    },
  );

  private async batchBusinessesByNames(names: readonly string[]) {
    const businesses = await getBusinessesByNames.run(
      {
        names,
      },
      this.dbProvider,
    );
    return names.map(name => businesses.find(fe => fe.name === name));
  }

  public getBusinessByNameLoader = new DataLoader(
    (keys: readonly string[]) => this.batchBusinessesByNames(keys),
    {
      cache: false,
    },
  );

  public getAllBusinesses() {
    return getAllBusinesses.run(undefined, this.dbProvider);
  }

  public getBusinessesByChargeIds(params: IGetBusinessesByChargeIdsParams) {
    return getBusinessesByChargeIds.run(params, this.dbProvider);
  }

  private async batchBusinessesByChargeIds(chargeIds: readonly string[]) {
    const businesses = await getBusinessesByChargeIds.run(
      {
        chargeIds,
      },
      this.dbProvider,
    );
    return chargeIds.map(chargeId => businesses.find(fe => fe.charge_id === chargeId) ?? null);
  }

  public getBusinessByChargeIdsLoader = new DataLoader(
    (keys: readonly string[]) => this.batchBusinessesByChargeIds(keys),
    { cache: false },
  );

  public updateBusiness(params: IUpdateBusinessParams) {
    return updateBusiness.run(params, this.dbProvider);
  }
}
