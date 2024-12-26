import { sql } from '@pgtyped/runtime';
import type { IGetTableColumnsQuery, IInsertFinancialAccountQuery } from './types.js';

export const insertFinancialAccount = sql<IInsertFinancialAccountQuery>`
  INSERT INTO accounter_schema.financial_accounts
  (
    account_number,
    type,
    owner,
    bank_number,
    branch_number,
    extended_bank_number,
    party_preferred_indication,
    party_account_involvement_code,
    account_deal_date,
    account_update_date,
    meteg_doar_net,
    kod_harshaat_peilut,
    account_closing_reason_code,
    account_agreement_opening_date,
    service_authorization_desc,
    branch_type_code,
    mymail_entitlement_switch,
    product_label,
    private_business
  )
  VALUES (
    $accountNumber,
    $type,
    $owner,
    $bankNumber,
    $branchNumber,
    $extendedBankNumber,
    $partyPreferredIndication,
    $partyAccountInvolvementCode,
    $accountDealDate,
    $accountUpdateDate,
    $metegDoarNet,
    $kodHarshaatPeilut,
    $accountClosingReasonCode,
    $accountAgreementOpeningDate,
    $serviceAuthorizationDesc,
    $branchTypeCode,
    $mymailEntitlementSwitch,
    $productLabel,
    $privateBusiness
  )
  RETURNING *;`;

export const getTableColumns = sql<IGetTableColumnsQuery>`
  SELECT * 
  FROM information_schema.columns
  WHERE table_schema = 'accounter_schema'
  AND table_name = $tableName;`;
