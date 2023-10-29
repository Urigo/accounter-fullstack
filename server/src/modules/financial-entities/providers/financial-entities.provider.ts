import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllFinancialEntitiesQuery,
  IGetFinancialEntitiesByChargeIdsParams,
  IGetFinancialEntitiesByChargeIdsQuery,
  IGetFinancialEntitiesByIdsQuery,
  IGetFinancialEntitiesByNamesQuery,
  IUpdateBusinessParams,
  IUpdateBusinessQuery,
} from '../types.js';

const getFinancialEntitiesByIds = sql<IGetFinancialEntitiesByIdsQuery>`
    SELECT *
    FROM accounter_schema.businesses
    WHERE id IN $$ids;`;

const getFinancialEntitiesByNames = sql<IGetFinancialEntitiesByNamesQuery>`
    SELECT *
    FROM accounter_schema.businesses
    WHERE name IN $$names;`;

const getAllFinancialEntities = sql<IGetAllFinancialEntitiesQuery>`
    SELECT *
    FROM accounter_schema.businesses;`;

const getFinancialEntitiesByChargeIds = sql<IGetFinancialEntitiesByChargeIdsQuery>`
    SELECT c.id as charge_id, bu.*
    FROM accounter_schema.charges c
    LEFT JOIN accounter_schema.businesses bu
    ON  c.owner_id = bu.id
    WHERE c.id IN $$chargeIds;`;

const updateBusiness = sql<IUpdateBusinessQuery>`
  UPDATE accounter_schema.businesses
  SET
  name = COALESCE(
    $name,
    name,
    NULL
  ),
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
  sort_code = COALESCE(
    $sortCode,
    sort_code
  )
  WHERE
    id = $businessId
  RETURNING *;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class FinancialEntitiesProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchFinancialEntitiesByIds(ids: readonly string[]) {
    const financialEntities = await getFinancialEntitiesByIds.run(
      {
        ids,
      },
      this.dbProvider,
    );
    return ids.map(id => financialEntities.find(fe => fe.id === id));
  }

  public getFinancialEntityByIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchFinancialEntitiesByIds(keys),
    {
      cache: false,
    },
  );

  private async batchFinancialEntitiesByNames(names: readonly string[]) {
    const financialEntities = await getFinancialEntitiesByNames.run(
      {
        names,
      },
      this.dbProvider,
    );
    return names.map(name => financialEntities.find(fe => fe.name === name));
  }

  public getFinancialEntityByNameLoader = new DataLoader(
    (keys: readonly string[]) => this.batchFinancialEntitiesByNames(keys),
    {
      cache: false,
    },
  );

  public getAllFinancialEntities() {
    return getAllFinancialEntities.run(undefined, this.dbProvider);
  }

  public getFinancialEntitiesByChargeIds(params: IGetFinancialEntitiesByChargeIdsParams) {
    return getFinancialEntitiesByChargeIds.run(params, this.dbProvider);
  }

  private async batchFinancialEntitiesByChargeIds(chargeIds: readonly string[]) {
    const financialEntities = await getFinancialEntitiesByChargeIds.run(
      {
        chargeIds,
      },
      this.dbProvider,
    );
    return chargeIds.map(
      chargeId => financialEntities.find(fe => fe.charge_id === chargeId) ?? null,
    );
  }

  public getFinancialEntityByChargeIdsLoader = new DataLoader(
    (keys: readonly string[]) => this.batchFinancialEntitiesByChargeIds(keys),
    { cache: false },
  );

  public updateBusiness(params: IUpdateBusinessParams) {
    return updateBusiness.run(params, this.dbProvider);
  }
}
