import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-11-09T10-03-45.financial-accounts-refactor-by-type.sql',
  run: ({ sql }) => sql`
CREATE TABLE
  accounter_schema.financial_bank_accounts (
    id uuid NOT NULL,
    bank_number integer NOT NULL,
    branch_number integer NOT NULL,
    extended_bank_number integer NULL,
    party_preferred_indication integer NULL,
    party_account_involvement_code integer NULL,
    account_deal_date integer NULL,
    account_update_date integer NULL,
    meteg_doar_net integer NULL,
    kod_harshaat_peilut integer NULL,
    account_closing_reason_code integer NULL,
    account_agreement_opening_date integer NULL,
    service_authorization_desc text NULL,
    branch_type_code integer NULL,
    mymail_entitlement_switch integer NULL,
    product_label text NULL
  );

ALTER TABLE
  accounter_schema.financial_bank_accounts
ADD
  CONSTRAINT financial_bank_accounts_pk PRIMARY KEY (id);

ALTER TABLE
  accounter_schema.financial_bank_accounts
ADD
  CONSTRAINT financial_bank_accounts_relation_1 FOREIGN KEY (id) REFERENCES accounter_schema.financial_accounts (id) ON UPDATE NO ACTION ON DELETE NO ACTION;

insert into
  accounter_schema.financial_bank_accounts (
    id,
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
    product_label
  )
SELECT
  id,
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
  product_label
FROM
  accounter_schema.financial_accounts
WHERE
  type = 'BANK_ACCOUNT';
`,
} satisfies MigrationExecutor;
