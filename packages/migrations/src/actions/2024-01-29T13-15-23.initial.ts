import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-01-29T13-15-23.initial.sql',
  run: ({ sql }) => sql`
    -- create types
    create type public.currency as enum ('ILS', 'USD', 'EUR', 'GBP', 'USDC', 'GRT', 'ETH');

    create type public.document_type as enum ('INVOICE', 'RECEIPT', 'INVOICE_RECEIPT', 'PROFORMA', 'UNPROCESSED', 'CREDIT_INVOICE');

    create type public.tags as enum ('Amazon Web Services EMEA SARL', 'beauty', 'business', 'clothes', 'Clothes', 'communications', 'computer', 'computers', 'conversion', 'creditcard', 'dotan', 'else', 'family', 'financial', 'financil', 'food', 'friends', 'fun', 'health', 'house', 'income', 'investments', 'learn', 'learning', 'love', 'lover', 'mistake', 'music', 'sports', 'stupid', 'stupidity', 'transportation', 'salary', 'Business Trip');

    create type public.business_trip_transaction_type as enum ('FLIGHT', 'ACCOMMODATION', 'TRAVEL_AND_SUBSISTENCE', 'OTHER');


    -- create accounter schema 

    CREATE SCHEMA accounter_schema;

    create table accounter_schema.exchange_rates
    (
        exchange_date date,
        usd           numeric(4, 3),
        eur           numeric(5, 4),
        gbp           numeric(5, 4)
    );

    create unique index exchange_rates_exchange_date_uindex
        on accounter_schema.exchange_rates (exchange_date);

    create table accounter_schema.isracard_creditcard_transactions
    (
        specific_date                     varchar(30),
        card_index                        integer                        not null,
        deals_inbound                     varchar(3),
        supplier_id                       integer,
        supplier_name                     varchar(15),
        deal_sum_type                     varchar(1),
        payment_sum_sign                  varchar(1),
        purchase_date                     varchar(5),
        full_purchase_date                text,
        more_info                         varchar(30),
        horaat_keva                       varchar(1),
        voucher_number                    integer,
        voucher_number_ratz               integer,
        solek                             varchar(1),
        purchase_date_outbound            varchar(5),
        full_purchase_date_outbound       text,
        currency_id                       varchar(4),
        current_payment_currency          varchar(3),
        city                              varchar(10),
        supplier_name_outbound            varchar(15),
        full_supplier_name_outbound       varchar(20),
        payment_date                      varchar(5),
        full_payment_date                 text,
        is_show_deals_outbound            varchar(1),
        adendum                           varchar(30),
        voucher_number_ratz_outbound      integer,
        is_show_link_for_supplier_details varchar(3),
        deal_sum                          varchar(8),
        payment_sum                       numeric(8, 2),
        full_supplier_name_heb            varchar(20),
        deal_sum_outbound                 numeric(9, 2),
        payment_sum_outbound              numeric(8, 2),
        is_horaat_keva                    varchar(5)                     not null,
        stage                             varchar(30),
        return_code                       varchar(30),
        message                           varchar(30),
        return_message                    varchar(30),
        display_properties                varchar(30),
        table_page_num                    bit                            not null,
        is_error                          varchar(5)                     not null,
        is_captcha                        varchar(5)                     not null,
        is_button                         varchar(5)                     not null,
        site_name                         varchar(30),
        client_ip_address                 varchar(30),
        card                              integer                        not null,
        id                                uuid default gen_random_uuid() not null
            constraint isracard_creditcard_transactions_pk
                primary key,
        charging_date                     text,
        kod_matbea_mekori                 text
    );

    create unique index isracard_creditcard_transactions_id_uindex
        on accounter_schema.isracard_creditcard_transactions (id);

    create table accounter_schema.poalim_eur_account_transactions
    (
        metadata_attributes_original_event_key              json,
        metadata_attributes_contra_branch_number            json,
        metadata_attributes_contra_account_number           json,
        metadata_attributes_contra_bank_number              json,
        metadata_attributes_contra_account_field_name_lable json,
        metadata_attributes_data_group_code                 json,
        metadata_attributes_currency_rate                   json,
        metadata_attributes_contra_currency_code            json,
        metadata_attributes_rate_fixing_code                json,
        executing_date                                      date                           not null,
        formatted_executing_date                            varchar(24)                    not null,
        value_date                                          date                           not null,
        formatted_value_date                                varchar(24)                    not null,
        original_system_id                                  integer                        not null,
        activity_description                                varchar(11)                    not null,
        event_amount                                        numeric(8, 2)                  not null,
        current_balance                                     numeric(9, 2)                  not null,
        reference_catenated_number                          integer                        not null,
        reference_number                                    integer                        not null,
        currency_rate                                       numeric(9, 7)                  not null,
        event_details                                       varchar(18),
        rate_fixing_code                                    integer                        not null,
        contra_currency_code                                integer                        not null,
        event_activity_type_code                            integer                        not null,
        transaction_type                                    varchar(7)                     not null,
        rate_fixing_short_description                       varchar(9)                     not null,
        currency_long_description                           text                           not null,
        activity_type_code                                  integer                        not null,
        event_number                                        integer                        not null,
        validity_date                                       date                           not null,
        comments                                            varchar(30),
        comment_existence_switch                            bit                            not null,
        account_name                                        varchar(30),
        contra_bank_number                                  integer                        not null,
        contra_branch_number                                integer                        not null,
        contra_account_number                               integer                        not null,
        original_event_key                                  bit                            not null,
        contra_account_field_name_lable                     varchar(30),
        data_group_code                                     bit                            not null,
        rate_fixing_description                             varchar(34),
        url_address_niar                                    varchar(30),
        currency_swift_code                                 varchar(3)                     not null,
        url_address                                         varchar(30),
        bank_number                                         integer                        not null,
        branch_number                                       integer                        not null,
        account_number                                      integer                        not null,
        id                                                  uuid default gen_random_uuid() not null
            constraint poalim_eur_account_transactions_pk
                primary key
    );

    create unique index poalim_eur_account_transactions_id_uindex
        on accounter_schema.poalim_eur_account_transactions (id);

    create table accounter_schema.poalim_ils_account_transactions
    (
        event_date                                date                           not null,
        formatted_event_date                      varchar(24)                    not null,
        serial_number                             integer                        not null,
        activity_type_code                        integer                        not null,
        activity_description                      varchar(14)                    not null,
        text_code                                 integer                        not null,
        reference_number                          bigint                         not null,
        reference_catenated_number                integer                        not null,
        value_date                                date                           not null,
        formatted_value_date                      varchar(24)                    not null,
        event_amount                              numeric(9, 2)                  not null,
        event_activity_type_code                  integer                        not null,
        current_balance                           numeric(9, 2)                  not null,
        internal_link_code                        integer                        not null,
        original_event_create_date                integer                        not null,
        formatted_original_event_create_date      varchar(30),
        transaction_type                          varchar(7)                     not null,
        data_group_code                           integer                        not null,
        beneficiary_details_data                  varchar(30),
        expanded_event_date                       bigint                         not null,
        executing_branch_number                   integer                        not null,
        event_id                                  integer                        not null,
        details                                   text,
        pfm_details                               varchar(30),
        different_date_indication                 varchar(1)                     not null,
        rejected_data_event_pertaining_indication varchar(1),
        table_number                              integer                        not null,
        record_number                             integer                        not null,
        contra_bank_number                        integer                        not null,
        contra_branch_number                      integer                        not null,
        contra_account_number                     integer                        not null,
        contra_account_type_code                  integer                        not null,
        marketing_offer_context                   bit                            not null,
        comment_existence_switch                  bit                            not null,
        english_action_desc                       varchar(14),
        field_desc_display_switch                 bit                            not null,
        url_address_niar                          varchar(30),
        offer_activity_context                    varchar(33),
        comment                                   varchar(30),
        beneficiary_details_data_party_name       varchar(24),
        beneficiary_details_data_message_headline varchar(5),
        beneficiary_details_data_party_headline   varchar(6),
        beneficiary_details_data_message_detail   varchar(34),
        beneficiary_details_data_table_number     integer,
        beneficiary_details_data_record_number    integer,
        activity_description_include_value_date   varchar(30),
        bank_number                               integer                        not null,
        branch_number                             integer                        not null,
        account_number                            integer                        not null,
        id                                        uuid default gen_random_uuid() not null
            constraint poalim_ils_account_transactions_pk
                primary key
    );

    comment on column accounter_schema.poalim_ils_account_transactions.serial_number is 'Serial number is how we order transactions in the same day, if they have the same amount.
    Lower number is earlier in the day.
    So you can''t have multiple rows with the same date, amount and same serial number.
    This is also referenced in the end of the expanded_event_date row';

    comment on column accounter_schema.poalim_ils_account_transactions.comment_existence_switch is 'Can change and get the same value on existing transaction again if the user added a comment';

    comment on column accounter_schema.poalim_ils_account_transactions.comment is 'Can change and get the same value on existing transaction again if the user added a comment';

    create unique index poalim_ils_account_transactions_id_uindex
        on accounter_schema.poalim_ils_account_transactions (id);

    create index poalim_ils_account_transactions_reference_number_index
        on accounter_schema.poalim_ils_account_transactions (reference_number);

    create index poalim_ils_account_transactions_event_date_index
        on accounter_schema.poalim_ils_account_transactions (event_date);

    create table accounter_schema.poalim_usd_account_transactions
    (
        metadata_attributes_original_event_key              json,
        metadata_attributes_contra_branch_number            json,
        metadata_attributes_contra_account_number           json,
        metadata_attributes_contra_bank_number              json,
        metadata_attributes_contra_account_field_name_lable json,
        metadata_attributes_data_group_code                 json,
        metadata_attributes_currency_rate                   json,
        metadata_attributes_contra_currency_code            json,
        metadata_attributes_rate_fixing_code                json,
        executing_date                                      date                           not null,
        formatted_executing_date                            varchar(24)                    not null,
        value_date                                          date                           not null,
        formatted_value_date                                varchar(24)                    not null,
        original_system_id                                  integer                        not null,
        activity_description                                varchar(11)                    not null,
        event_amount                                        numeric(10, 2)                 not null,
        current_balance                                     numeric(10, 2)                 not null,
        reference_catenated_number                          integer                        not null,
        reference_number                                    integer                        not null,
        currency_rate                                       numeric(9, 7)                  not null,
        event_details                                       varchar(14),
        rate_fixing_code                                    integer                        not null,
        contra_currency_code                                integer                        not null,
        event_activity_type_code                            integer                        not null,
        transaction_type                                    varchar(7)                     not null,
        rate_fixing_short_description                       varchar(9)                     not null,
        currency_long_description                           text                           not null,
        activity_type_code                                  integer                        not null,
        event_number                                        integer                        not null,
        validity_date                                       date                           not null,
        comments                                            varchar(30),
        comment_existence_switch                            bit                            not null,
        account_name                                        varchar(30),
        contra_bank_number                                  integer                        not null,
        contra_branch_number                                integer                        not null,
        contra_account_number                               integer                        not null,
        original_event_key                                  bit                            not null,
        contra_account_field_name_lable                     varchar(30),
        data_group_code                                     bit                            not null,
        rate_fixing_description                             varchar(34),
        url_address_niar                                    varchar(30),
        currency_swift_code                                 varchar(3)                     not null,
        url_address                                         varchar(30),
        bank_number                                         integer                        not null,
        branch_number                                       integer                        not null,
        account_number                                      integer                        not null,
        id                                                  uuid default gen_random_uuid() not null
            constraint poalim_usd_account_transactions_pk
                primary key
    );

    create unique index poalim_usd_account_transactions_id_uindex
        on accounter_schema.poalim_usd_account_transactions (id);

    create table accounter_schema.financial_accounts
    (
        account_number                 text                           not null,
        private_business               text default 'business'::text  not null,
        owner                          uuid,
        hashavshevet_account_ils       text,
        hashavshevet_account_usd       text,
        hashavshevet_account_eur       text,
        bank_number                    integer,
        branch_number                  integer,
        extended_bank_number           integer,
        party_preferred_indication     integer,
        party_account_involvement_code integer,
        account_deal_date              integer,
        account_update_date            integer,
        meteg_doar_net                 integer,
        kod_harshaat_peilut            integer,
        account_closing_reason_code    integer,
        account_agreement_opening_date integer,
        service_authorization_desc     text,
        branch_type_code               integer,
        mymail_entitlement_switch      integer,
        hashavshevet_account_gbp       text,
        id                             uuid default gen_random_uuid() not null
            constraint financial_accounts_pk
                primary key,
        type                           text                           not null
    );

    comment on column accounter_schema.financial_accounts.meteg_doar_net is 'Getting mail only online or physical
    0 - Also physical
    1 - Only online';

    create unique index financial_accounts_id_uindex
        on accounter_schema.financial_accounts (id);

    create table accounter_schema.poalim_deposits_account_transactions
    (
        data_0_short_product_name                         varchar(5)    not null
            constraint data_0_short_product_name_enum
                check ((data_0_short_product_name)::text = 'פריים'::text),
        data_0_principal_amount                           numeric(8, 2) not null,
        data_0_revalued_total_amount                      numeric(8, 2) not null,
        data_0_end_exit_date                              date          not null,
        data_0_payment_date                               date          not null,
        data_0_stated_annual_interest_rate                bit           not null,
        data_0_hebrew_purpose_description                 varchar(10)   not null
            constraint data_0_hebrew_purpose_description_enum
                check ((data_0_hebrew_purpose_description)::text = 'לא רלוונטי'::text),
        data_0_objective_amount                           bit           not null,
        data_0_objective_date                             bit           not null,
        data_0_agreement_opening_date                     date          not null,
        data_0_event_withdrawal_amount                    bit           not null,
        data_0_start_exit_date                            date          not null,
        data_0_period_until_next_event                    integer       not null,
        data_0_renewal_description                        varchar(12)   not null
            constraint data_0_renewal_description_enum
                check ((data_0_renewal_description)::text = ANY
                      ((ARRAY ['פיקדון מתחדש'::character varying, 'יפרע לעו"ש'::character varying])::text[])),
        data_0_requested_renewal_number                   bit           not null,
        data_0_interest_base_description                  varchar(5)    not null
            constraint data_0_interest_base_description_enum
                check ((data_0_interest_base_description)::text = 'פריים'::text),
        data_0_interest_type_description                  varchar(5)    not null
            constraint data_0_interest_type_description_enum
                check ((data_0_interest_type_description)::text = 'משתנה'::text),
        data_0_spread_percent                             numeric(5, 2) not null,
        data_0_variable_interest_description              varchar(22)   not null,
        data_0_adjusted_interest                          numeric(4, 2) not null,
        data_0_interest_calculating_method_description    varchar(6)    not null
            constraint data_0_interest_calculating_method_description_enum
                check ((data_0_interest_calculating_method_description)::text = 'קו ישר'::text),
        data_0_interest_crediting_method_description      varchar(12)   not null
            constraint data_0_interest_crediting_method_description_enum
                check ((data_0_interest_crediting_method_description)::text = 'לקרן הפיקדון'::text),
        data_0_interest_payment_description               varchar(4)    not null
            constraint data_0_interest_payment_description_enum
                check ((data_0_interest_payment_description)::text = 'תחנה'::text),
        data_0_nominal_interest                           numeric(4, 2) not null,
        data_0_deposit_serial_id                          integer       not null,
        data_0_linkage_base_description                   varchar(30),
        data_0_renewal_counter                            integer       not null,
        data_0_product_free_text                          varchar(30)   not null,
        data_0_party_text_id                              bigint        not null,
        data_0_actual_index_rate                          bit           not null,
        data_0_interest_type_code                         integer       not null,
        data_0_product_number                             integer       not null,
        data_0_product_purpose_code                       bit           not null,
        data_0_detailed_account_type_code                 integer       not null,
        data_0_formatted_end_exit_date                    varchar(24)   not null,
        data_0_formatted_payment_date                     varchar(24)   not null,
        data_0_formatted_objective_date                   varchar(30),
        data_0_formatted_agreement_opening_date           varchar(24)   not null,
        data_0_formatted_start_exit_date                  varchar(24)   not null,
        data_0_lien_description                           varchar(11)
            constraint data_0_lien_description_enum
                check ((data_0_lien_description)::text = ANY
                      ((ARRAY ['משועבד'::character varying, 'מבטיח אשראי'::character varying])::text[])),
        data_0_withdrawal_enabling_indication             bit           not null,
        data_0_renewal_enabling_indication                bit           not null,
        data_0_standing_order_enabling_indication         bit           not null,
        data_0_addition_enabling_indication               bit           not null,
        data_0_time_unit_description                      varchar(4)    not null
            constraint data_0_time_unit_description_enum
                check ((data_0_time_unit_description)::text = 'ימים'::text),
        data_0_formatted_revalued_total_amount            varchar(30),
        data_0_warning_existance_indication               bit           not null,
        data_0_renewal_date_explanation                   varchar(18)   not null
            constraint data_0_renewal_date_explanation_enum
                check ((data_0_renewal_date_explanation)::text = ANY
                      ((ARRAY ['תחנה קרובה'::character varying, 'ייפרע לעו"ש בתאריך'::character varying])::text[])),
        source                                            varchar(22)   not null
            constraint source_enum
                check ((source)::text = 'israeliCurrencyDeposit'::text),
        validity_date                                     date          not null,
        validity_time                                     integer       not null,
        israeli_currency_deposit_principal_balance_amount numeric(8, 2) not null,
        deposits_revalued_amount                          numeric(8, 2) not null,
        formatted_validity_time                           varchar(5)    not null,
        formatted_date                                    varchar(24)   not null,
        amount                                            numeric(8, 2) not null,
        revaluated_amount                                 numeric(8, 2) not null,
        account_number                                    integer       not null,
        branch_number                                     integer       not null,
        bank_number                                       integer       not null
    );

    create table accounter_schema.poalim_gbp_account_transactions
    (
        metadata_attributes_original_event_key              json,
        metadata_attributes_contra_branch_number            json,
        metadata_attributes_contra_account_number           json,
        metadata_attributes_contra_bank_number              json,
        metadata_attributes_contra_account_field_name_lable json,
        metadata_attributes_data_group_code                 json,
        metadata_attributes_currency_rate                   json,
        metadata_attributes_contra_currency_code            json,
        metadata_attributes_rate_fixing_code                json,
        executing_date                                      date                           not null,
        formatted_executing_date                            varchar(24)                    not null,
        value_date                                          date                           not null,
        formatted_value_date                                varchar(24)                    not null,
        original_system_id                                  integer                        not null,
        activity_description                                varchar(11)                    not null,
        event_amount                                        numeric(8, 2)                  not null,
        current_balance                                     numeric(9, 2)                  not null,
        reference_catenated_number                          integer                        not null,
        reference_number                                    integer                        not null,
        currency_rate                                       numeric(9, 7)                  not null,
        event_details                                       varchar(18),
        rate_fixing_code                                    integer                        not null,
        contra_currency_code                                integer                        not null,
        event_activity_type_code                            integer                        not null,
        transaction_type                                    varchar(7)                     not null,
        rate_fixing_short_description                       varchar(9)                     not null,
        currency_long_description                           text                           not null,
        activity_type_code                                  integer                        not null,
        event_number                                        integer                        not null,
        validity_date                                       date                           not null,
        comments                                            varchar(30),
        comment_existence_switch                            bit                            not null,
        account_name                                        varchar(30),
        contra_bank_number                                  integer                        not null,
        contra_branch_number                                integer                        not null,
        contra_account_number                               integer                        not null,
        original_event_key                                  bit                            not null,
        contra_account_field_name_lable                     varchar(30),
        data_group_code                                     bit                            not null,
        rate_fixing_description                             varchar(34),
        url_address_niar                                    varchar(30),
        currency_swift_code                                 varchar(3)                     not null,
        url_address                                         varchar(30),
        bank_number                                         integer                        not null,
        branch_number                                       integer                        not null,
        account_number                                      integer                        not null,
        id                                                  uuid default gen_random_uuid() not null
            constraint poalim_gbp_account_transactions_pk
                primary key
    );

    create unique index poalim_gbp_account_transactions_id_uindex
        on accounter_schema.poalim_gbp_account_transactions (id);

    create table accounter_schema.sort_codes
    (
        key  integer not null
            constraint hash_sort_codes_pk
                primary key,
        name text
    );

    create table accounter_schema.businesses
    (
        name                        text                              not null,
        id                          uuid    default gen_random_uuid() not null
            constraint businesses_pk
                primary key,
        vat_number                  text,
        tax_siduri_number_2021      text,
        password                    text,
        username_vat_website        text,
        website_login_screenshot    text,
        nikuim                      text,
        pinkas_social_security_2021 text,
        hebrew_name                 text,
        tax_pinkas_number_2020      text,
        address                     text,
        address_hebrew              text,
        wizcloud_token              text,
        wizcloud_company_id         text,
        advance_tax_rate            real,
        email                       text,
        website                     text,
        phone_number                text,
        bank_account_bank_number    integer,
        bank_account_branch_number  integer,
        bank_account_account_number integer,
        "bank_account_IBAN"         text,
        tax_nikuim_pinkas_number    text,
        bank_account_swift          text,
        vat_report_cadence          integer,
        contract                    text,
        country                     text    default 'Israel'::text    not null,
        pinkas_social_security_2022 text,
        tax_siduri_number_2022      text,
        registration_date           date,
        no_invoices_required        boolean default false             not null,
        suggestion_data             jsonb,
        can_settle_with_receipt     boolean default false             not null,
        sort_code                   integer
            constraint businesses_hash_sort_codes_key_fk
                references accounter_schema.sort_codes
    );

    create unique index businesses_id_uindex
        on accounter_schema.businesses (id);

    create unique index businesses_tax_note_number_uindex
        on accounter_schema.businesses (tax_siduri_number_2021);

    create unique index businesses_name_uindex
        on accounter_schema.businesses (name);

    create table accounter_schema.employees
    (
        first_name                  text,
        last_name                   text,
        pension_fund_id             uuid,
        pension_member_id           text,
        national_id                 text,
        birth_date                  text,
        pension_policy_number       text,
        training_fund_policy_number text,
        training_fund_start_date    text,
        employer                    uuid,
        gender                      text,
        family_status               text,
        role_status                 text,
        phone_number                text,
        address                     text,
        israel_resident             boolean,
        kibutz_member               boolean,
        kupat_holim                 text,
        start_work_date             text,
        email                       text,
        bank_number                 integer,
        account_number              integer,
        branch_number               integer,
        business_id                 uuid not null
            constraint employees_pk
                primary key
            constraint employees_businesses_id_fk
                references accounter_schema.businesses
    );

    create unique index employees_business_id_uindex
        on accounter_schema.employees (business_id);

    create table accounter_schema.pension_funds
    (
        name                        text not null,
        otsar_id                    text,
        id                          uuid not null
            constraint pension_funds_pk
                primary key
            constraint pension_funds_businesses_id_fk
                references accounter_schema.businesses,
        type                        text,
        management_fees             numeric(9, 2),
        links                       text[],
        bank_account_bank_number    integer,
        bank_account_branch_number  integer,
        bank_account_account_number integer,
        bank_account_name           text,
        email                       text,
        managing_company_name       text,
        managing_company_id         text,
        emails                      text[]
    );

    create unique index pension_funds_id_uindex
        on accounter_schema.pension_funds (id);

    create unique index hash_sort_codes_key_uindex
        on accounter_schema.sort_codes (key);

    create table accounter_schema.etherscan_transactions
    (
        tx_id            text                           not null,
        wallet_address   text                           not null,
        contract_address text                           not null,
        from_address     text                           not null,
        to_address       text                           not null,
        currency         text                           not null,
        transaction_hash text,
        amount           numeric                        not null,
        value_date       date                           not null,
        raw_data         jsonb                          not null,
        event_date       timestamp                      not null,
        gas_fee          numeric,
        id               uuid default gen_random_uuid() not null,
        primary key (tx_id, currency)
    );

    create unique index etherscan_transactions_id_uindex
        on accounter_schema.etherscan_transactions (id);

    create table accounter_schema.etana_account_transactions
    (
        transaction_id text    not null
            primary key,
        account_id     text    not null,
        time           date    not null,
        currency       text    not null,
        amount         numeric not null,
        description    text    not null,
        fee            numeric,
        fee_tx_id      text,
        metadata       text,
        action_type    text    not null,
        raw_data       jsonb   not null
    );

    create table accounter_schema.poalim_swift_account_transactions
    (
        start_date                           text,
        formatted_start_date                 text,
        swift_status_code                    text,
        swift_status_desc                    text,
        amount                               text,
        currency_code_catenated_key          text,
        currency_long_description            text,
        charge_party_name                    text,
        reference_number                     text,
        transfer_catenated_id                text,
        data_origin_code                     text,
        swift_isn_serial_number              text,
        swift_bank_code                      text,
        order_customer_name                  text,
        beneficiary_english_street_name      text,
        beneficiary_english_city_name        text,
        beneficiary_english_country_name     text,
        swift_senders_reference_20           text,
        swift_bank_operation_code_23b        text,
        swift_value_date_currency_amount_32a text,
        swift_currency_instructed_amount_33b text,
        swift_ordering_customer_50k_1        text,
        swift_ordering_customer_50k_2        text,
        swift_ordering_customer_50k_3        text,
        swift_ordering_customer_50k_4        text,
        swift_ordering_customer_50k_5        text,
        swift_ordering_institution_52a       text,
        swift_senders_correspondent_53a      text,
        swift_beneficiary_customer_59_1      text,
        swift_beneficiary_customer_59_2      text,
        swift_beneficiary_customer_59_3      text,
        swift_beneficiary_customer_59_4      text,
        swift_beneficiary_customer_59_5      text,
        swift_remittance_information_70_1    text,
        swift_remittance_information_70_2    text,
        swift_details_of_charges_71a         text,
        account_number                       integer,
        branch_number                        integer,
        bank_number                          integer,
        swift_senders_charges_71f            text,
        swift_ordering_institution_52d_1     text,
        swift_ordering_institution_52d_2     text,
        swift_ordering_institution_52d_3     text,
        swift_receivers_correspondent_54a    text,
        id                                   uuid default gen_random_uuid() not null
            constraint poalim_swift_account_transactions_pk
                primary key
    );

    create table accounter_schema.transactions_raw_list
    (
        id              uuid default gen_random_uuid() not null
            constraint transactions_raw_list_pk
                primary key,
        creditcard_id   uuid
            constraint transactions_raw_list_isracard_creditcard_transactions_id_fk
                references accounter_schema.isracard_creditcard_transactions,
        poalim_ils_id   uuid
            constraint transactions_raw_list_poalim_ils_account_transactions_id_fk
                references accounter_schema.poalim_ils_account_transactions,
        poalim_eur_id   uuid
            constraint transactions_raw_list_poalim_eur_account_transactions_id_fk
                references accounter_schema.poalim_eur_account_transactions,
        poalim_gbp_id   uuid
            constraint transactions_raw_list_poalim_gbp_account_transactions_id_fk
                references accounter_schema.poalim_gbp_account_transactions,
        poalim_usd_id   uuid
            constraint transactions_raw_list_poalim_usd_account_transactions_id_fk
                references accounter_schema.poalim_usd_account_transactions,
        kraken_id       text,
        etana_id        text,
        etherscan_id    uuid,
        poalim_swift_id uuid
            constraint transactions_raw_list_poalim_swift_account_transactions_id_fk
                references accounter_schema.poalim_swift_account_transactions,
        constraint transactions_raw_list_check
            check (((((((((((creditcard_id IS NOT NULL))::integer + ((poalim_ils_id IS NOT NULL))::integer) +
                          ((poalim_eur_id IS NOT NULL))::integer) + ((poalim_gbp_id IS NOT NULL))::integer) +
                        ((poalim_usd_id IS NOT NULL))::integer) + ((poalim_swift_id IS NOT NULL))::integer) +
                      ((kraken_id IS NOT NULL))::integer) + ((etana_id IS NOT NULL))::integer) +
                    ((etherscan_id IS NOT NULL))::integer) = 1)
    );

    create unique index transactions_raw_list_id_uindex
        on accounter_schema.transactions_raw_list (id);

    create unique index transactions_raw_list_creditcard_id_uindex
        on accounter_schema.transactions_raw_list (creditcard_id)
        where (creditcard_id IS NOT NULL);

    create unique index transactions_raw_list_poalim_eur_id_uindex
        on accounter_schema.transactions_raw_list (poalim_eur_id)
        where (poalim_eur_id IS NOT NULL);

    create unique index transactions_raw_list_poalim_gbp_id_uindex
        on accounter_schema.transactions_raw_list (poalim_gbp_id)
        where (poalim_gbp_id IS NOT NULL);

    create unique index transactions_raw_list_poalim_ils_id_uindex
        on accounter_schema.transactions_raw_list (poalim_ils_id)
        where (poalim_ils_id IS NOT NULL);

    create unique index transactions_raw_list_poalim_usd_id_uindex
        on accounter_schema.transactions_raw_list (poalim_usd_id)
        where (poalim_usd_id IS NOT NULL);

    create unique index poalim_swift_account_transactions_id_uindex
        on accounter_schema.poalim_swift_account_transactions (id);

    create table accounter_schema.kraken_trades
    (
        trade_id         text      not null
            primary key,
        account_nickname text      not null,
        pair             text      not null,
        value_date       timestamp not null,
        order_type       text      not null,
        price            numeric   not null,
        cost             numeric   not null,
        fee              numeric   not null,
        vol              numeric   not null,
        margin           numeric   not null,
        raw_data         jsonb     not null
    );

    create table accounter_schema.kraken_ledger_records
    (
        ledger_id        text      not null
            primary key,
        account_nickname text      not null,
        action_type      text      not null,
        currency         text      not null,
        amount           numeric   not null,
        balance          numeric   not null,
        fee              numeric   not null,
        value_date       timestamp not null,
        trade_ref_id     text,
        raw_data         jsonb     not null
    );

    create table accounter_schema.crypto_currencies
    (
        symbol           text not null
            constraint crypto_currencies_pk
                primary key,
        name             text not null,
        coingecko_id     text,
        coinmarketcap_id integer
    );

    create unique index crypto_currencies_symbol_uindex
        on accounter_schema.crypto_currencies (symbol);

    create table accounter_schema.crypto_exchange_rates
    (
        date        timestamp                        not null,
        coin_symbol text                             not null
            constraint crypto_exchange_rates_crypto_currencies_symbol_fk
                references accounter_schema.crypto_currencies,
        value       numeric                          not null,
        against     currency default 'USD'::currency not null,
        sample_date timestamp                        not null,
        constraint crypto_exchange_rates_pk_2
            primary key (date, coin_symbol, against),
        constraint crypto_exchange_rates_pk
            unique (date, coin_symbol)
    );

    create table accounter_schema.business_trips
    (
        id           uuid default gen_random_uuid() not null,
        name         text                           not null,
        from_date    date,
        to_date      date,
        destination  text,
        trip_purpose text
    );

    create unique index business_trips_id_uindex
        on accounter_schema.business_trips (id);

    create unique index business_trips_name_uindex
        on accounter_schema.business_trips (name);

    create table accounter_schema.business_trips_attendees
    (
        attendee_business_id uuid not null
            constraint business_trips_attendees_businesses_id_fk
                references accounter_schema.businesses,
        business_trip_id     uuid not null
            constraint business_trips_attendees_business_trips_id_fk
                references accounter_schema.business_trips (id),
        constraint business_trips_attendees_pk
            primary key (business_trip_id, attendee_business_id)
    );

    create table accounter_schema.business_trips_transactions_tns
    (
        id           uuid not null
            constraint business_trips_transactions_tns_pk
                primary key,
        expense_type text
    );

    create unique index business_trips_transactions_tns_id_uindex
        on accounter_schema.business_trips_transactions_tns (id);

    create table accounter_schema.financial_entities
    (
        id         uuid      default gen_random_uuid() not null
            constraint financial_entities_pk
                primary key,
        type       text,
        owner_id   uuid
            constraint financial_entities_businesses_id_fk
                references accounter_schema.businesses,
        name       text                                not null,
        sort_code  integer
            constraint financial_entities_hash_sort_codes_key_fk
                references accounter_schema.sort_codes,
        created_at timestamp default CURRENT_TIMESTAMP not null,
        updated_at timestamp default CURRENT_TIMESTAMP not null
    );

    alter table accounter_schema.businesses
        add constraint businesses_financial_entities_id_fk
            foreign key (id) references accounter_schema.financial_entities;

    create table accounter_schema.tax_categories
    (
        id                uuid default gen_random_uuid() not null
            constraint tax_categories_pk
                primary key
            constraint tax_categories_financial_entities_id_fk
                references accounter_schema.financial_entities,
        name              text                           not null,
        hashavshevet_name text,
        sort_code         integer                        not null
            constraint tax_categories_hash_sort_codes_key_fk
                references accounter_schema.sort_codes
    );

    create table accounter_schema.charges
    (
        id                  uuid      default gen_random_uuid() not null
            constraint charges_pk
                primary key,
        owner_id            uuid                                not null
            constraint charges_businesses_id_fk
                references accounter_schema.businesses,
        is_conversion       boolean   default false             not null,
        is_property         boolean   default false             not null,
        accountant_reviewed boolean   default false             not null,
        user_description    text,
        created_at          timestamp default CURRENT_TIMESTAMP not null,
        updated_at          timestamp default CURRENT_TIMESTAMP not null,
        tax_category_id     uuid
            constraint charges_tax_categories_id_fk
                references accounter_schema.tax_categories
    );

    create table accounter_schema.salaries
    (
        direct_payment_amount             numeric(9, 2) not null,
        employee                          text,
        employer                          uuid          not null,
        month                             text          not null,
        base_salary                       numeric(9, 2),
        social_security_amount_employee   numeric(9, 2),
        health_payment_amount             numeric(9, 2),
        tax_amount                        numeric(9, 2),
        pension_employer_amount           numeric(9, 2),
        pension_employee_amount           numeric(9, 2),
        vacation_days_balance             numeric(9, 2),
        sickness_days_balance             numeric(9, 2),
        pension_employee_percentage       real,
        pension_employer_percentage       real,
        compensations_employer_percentage real,
        training_fund_employer_amount     numeric(9, 2),
        training_fund_employee_amount     numeric(9, 2),
        training_fund_employer_percentage real,
        training_fund_employee_percentage real,
        compensations_employer_amount     numeric(9, 2),
        pension_fund_id                   uuid
            constraint salaries_pension_funds_id_id_fk
                references accounter_schema.pension_funds,
        training_fund_id                  uuid
            constraint salaries_pension_funds_id_fk
                references accounter_schema.pension_funds,
        work_days                         numeric(9, 2),
        hours                             numeric(9, 2),
        hourly_rate                       numeric(9, 2),
        added_vacation_days               numeric(9, 2),
        social_security_amount_employer   numeric(9, 2),
        global_additional_hours           numeric(9, 2),
        zkufot                            integer,
        employee_id                       uuid          not null
            constraint salaries_employees_business_id_fk
                references accounter_schema.employees,
        recovery                          numeric(9, 2),
        gift                              numeric(9, 2),
        bonus                             numeric(9, 2),
        vacation_takeout                  numeric(9, 2),
        charge_id                         uuid
            constraint salaries_charges_id_fk
                references accounter_schema.charges,
        constraint salaries_pk
            primary key (month, employee_id)
    );

    create table accounter_schema.documents
    (
        id            uuid                     default gen_random_uuid()            not null
            constraint documents_pk
                primary key,
        image_url     text,
        file_url      text,
        type          document_type            default 'UNPROCESSED'::document_type not null,
        created_at    timestamp with time zone default now()                        not null,
        modified_at   timestamp with time zone default now()                        not null,
        serial_number text,
        date          date,
        total_amount  double precision,
        currency_code currency,
        vat_amount    double precision,
        debtor        text,
        creditor      text,
        is_reviewed   boolean                  default false                        not null,
        charge_id_new uuid
            constraint documents_charges_id_fk
                references accounter_schema.charges,
        debtor_id     uuid,
        creditor_id   uuid,
        description   text,
        no_vat_amount numeric
    );

    create index documents_charge_id_new_index
        on accounter_schema.documents (charge_id_new);

    create index documents_creditor_id_index
        on accounter_schema.documents (creditor_id);

    create index documents_date_index
        on accounter_schema.documents (date);

    create index documents_debtor_id_index
        on accounter_schema.documents (debtor_id);

    create index documents_total_amount_index
        on accounter_schema.documents (total_amount);

    create index charges_owner_id_index
        on accounter_schema.charges (owner_id);

    create table accounter_schema.transactions
    (
        id                 uuid      default gen_random_uuid() not null
            constraint transactions_pk
                primary key,
        account_id         uuid                                not null
            constraint transactions_financial_accounts_id_fk
                references accounter_schema.financial_accounts,
        charge_id          uuid                                not null
            constraint transactions_charges_id_fk
                references accounter_schema.charges,
        source_id          uuid                                not null
            constraint transactions_transactions_raw_list_id_fk
                references accounter_schema.transactions_raw_list,
        source_description text,
        currency           currency                            not null,
        event_date         date                                not null,
        debit_date         date,
        amount             numeric                             not null,
        current_balance    numeric                             not null,
        business_id        uuid
            constraint transactions_businesses_id_fk
                references accounter_schema.businesses,
        created_at         timestamp default CURRENT_TIMESTAMP not null,
        updated_at         timestamp default CURRENT_TIMESTAMP not null,
        is_fee             boolean
    );

    create index transactions_account_id_index
        on accounter_schema.transactions (account_id)
        where (account_id IS NOT NULL);

    create index transactions_charge_id_index
        on accounter_schema.transactions (charge_id)
        where (charge_id IS NOT NULL);

    create index transactions_amount_index
        on accounter_schema.transactions (amount);

    create index transactions_debit_date_index
        on accounter_schema.transactions (debit_date);

    create index transactions_event_date_index
        on accounter_schema.transactions (event_date);

    create table accounter_schema.tags
    (
        charge_id uuid not null
            constraint tags_charges_id_fk
                references accounter_schema.charges,
        tag_name  tags not null,
        constraint tags_pk
            primary key (charge_id, tag_name)
    );

    create index tags_charge_id_index
        on accounter_schema.tags (charge_id);

    create index tags_charge_id_index_2
        on accounter_schema.tags (charge_id);

    create unique index tax_categories_id_uindex
        on accounter_schema.tax_categories (id);

    create table accounter_schema.business_tax_category_match
    (
        business_id     uuid not null
            constraint business_tax_category_match_businesses_id_fk
                references accounter_schema.businesses,
        owner_id        uuid not null
            constraint business_tax_category_match_owner_fk
                references accounter_schema.businesses,
        tax_category_id uuid not null
            constraint business_tax_category_match_tax_categories_id_fk
                references accounter_schema.tax_categories,
        constraint business_tax_category_match_pk
            primary key (business_id, owner_id)
    );

    create table accounter_schema.business_trip_charges
    (
        business_trip_id uuid
            constraint business_trip_charges_business_trips_id_fk
                references accounter_schema.business_trips (id),
        charge_id        uuid not null
            constraint business_trip_charges_pk
                primary key
            constraint business_trip_charges_charges_id_fk
                references accounter_schema.charges
    );

    create unique index business_trip_charges_charge_id_uindex
        on accounter_schema.business_trip_charges (charge_id);

    create table accounter_schema.dividends
    (
        id                                  uuid default gen_random_uuid() not null
            constraint dividends_pk
                primary key,
        business_id                         uuid                           not null
            constraint dividends_businesses_id_fk
                references accounter_schema.businesses,
        amount                              numeric                        not null,
        date                                date                           not null,
        transaction_id                      uuid
            constraint dividends_transactions_id_fk
                references accounter_schema.transactions,
        owner_id                            uuid                           not null,
        withholding_tax_percentage_override numeric
    );

    create unique index dividends_id_uindex
        on accounter_schema.dividends (id);

    create table accounter_schema.business_trips_transactions
    (
        id                   uuid    default gen_random_uuid() not null
            constraint business_trips_transactions_pk
                primary key,
        business_trip_id     uuid                              not null
            constraint business_trips_transactions_business_trips_id_fk
                references accounter_schema.business_trips (id),
        category             business_trip_transaction_type,
        date                 date,
        amount               numeric,
        currency             currency,
        employee_business_id uuid
            constraint business_trips_transactions_businesses_id_fk
                references accounter_schema.businesses,
        transaction_id       uuid
            constraint business_trips_transactions_transactions_id_fk
                references accounter_schema.transactions,
        payed_by_employee    boolean default false             not null,
        value_date           date,
        constraint require_info_if_no_linked_transaction
            check ((transaction_id IS NOT NULL) OR
                  ((date IS NOT NULL) AND (amount IS NOT NULL) AND (currency IS NOT NULL) AND
                    (employee_business_id IS NOT NULL)))
    );

    create unique index business_trips_transactions_transaction_id_uindex
        on accounter_schema.business_trips_transactions (transaction_id);

    create table accounter_schema.business_trips_transactions_flights
    (
        id          uuid not null
            constraint business_trips_transactions_flights_pk
                primary key
            constraint business_trips_transactions_flights_business_trips_transactions
                references accounter_schema.business_trips_transactions,
        origin      text,
        destination text,
        class       text
    );

    create unique index business_trips_transactions_flights_id_uindex
        on accounter_schema.business_trips_transactions_flights (id);

    create table accounter_schema.business_trips_transactions_accommodations
    (
        id           uuid not null
            constraint business_trips_transactions_accommodations_pk
                primary key
            constraint business_trips_transactions_accommodations_business_trips_trans
                references accounter_schema.business_trips_transactions,
        country      text,
        nights_count integer
    );

    create unique index business_trips_transactions_accommodations_id_uindex
        on accounter_schema.business_trips_transactions_accommodations (id);

    create table accounter_schema.business_trips_transactions_other
    (
        id                 uuid not null
            constraint business_trips_transactions_other_pk
                primary key
            constraint business_trips_transactions_other_business_trips_transactions_i
                references accounter_schema.business_trips_transactions,
        deductible_expense boolean,
        expense_type       text
    );

    create unique index business_trips_transactions_other_id_uindex
        on accounter_schema.business_trips_transactions_other (id);

    create table accounter_schema.charge_unbalanced_ledger_businesses
    (
        charge_id   uuid not null
            constraint "charge-unbalanced-ledger-businesses_charges_id_fk"
                references accounter_schema.charges,
        business_id uuid not null
            constraint "charge-unbalanced-ledger-businesses_businesses_id_fk"
                references accounter_schema.businesses,
        remark      text,
        constraint "charge-unbalanced-ledger-businesses_pk"
            primary key (charge_id, business_id)
    );

    create table accounter_schema.charge_balance_cancellation
    (
        charge_id   uuid not null
            constraint charge_balance_cancellation_charges_id_fk
                references accounter_schema.charges,
        description text,
        business_id uuid not null
            constraint charge_balance_cancellation_businesses_id_fk
                references accounter_schema.businesses,
        constraint charge_balance_cancellation_pk
            primary key (charge_id, business_id)
    );

    create unique index charge_balance_cancellation_id_uindex
        on accounter_schema.charge_balance_cancellation (charge_id);

    create index financial_entities_name_index
        on accounter_schema.financial_entities (name);

    create table accounter_schema.ledger_records
    (
        id                     uuid      default gen_random_uuid() not null
            constraint ledger_records_pk
                primary key,
        owner_id               uuid
            constraint ledger_records_businesses_id_fk
                references accounter_schema.businesses,
        charge_id              uuid                                not null,
        debit_entity1          uuid
            constraint ledger_records_financial_entities_id_fk
                references accounter_schema.financial_entities,
        debit_foreign_amount1  numeric,
        debit_local_amount1    numeric,
        credit_entity1         uuid
            constraint ledger_records_financial_entities_id_fk_2
                references accounter_schema.financial_entities,
        credit_foreign_amount1 numeric,
        credit_local_amount1   numeric,
        debit_entity2          uuid
            constraint ledger_records_financial_entities_id_fk_3
                references accounter_schema.financial_entities,
        debit_foreign_amount2  numeric,
        debit_local_amount2    numeric,
        credit_entity2         uuid
            constraint ledger_records_financial_entities_id_fk_4
                references accounter_schema.financial_entities,
        credit_foreign_amount2 numeric,
        credit_local_amount2   numeric,
        currency               currency                            not null,
        invoice_date           date                                not null,
        value_date             date                                not null,
        description            text,
        reference1             text,
        created_at             timestamp default CURRENT_TIMESTAMP not null,
        updated_at             timestamp default CURRENT_TIMESTAMP not null
    );

    create index ledger_records_id_charge_id_index
        on accounter_schema.ledger_records (id, charge_id);

    create view accounter_schema.extended_transactions
                (id, charge_id, business_id, currency, debit_date, debit_timestamp, event_date, account_id, account_type,
                amount, current_balance, source_description, source_details, created_at, updated_at, source_id,
                source_reference, source_origin, currency_rate, is_conversion, is_fee)
    as
    SELECT DISTINCT ON (t.id) t.id,
                              t.charge_id,
                              t.business_id,
                              t.currency,
                              CASE
                                  WHEN ot.origin = 'ISRACARD'::text AND t.currency = 'ILS'::currency AND
                                      t.debit_date IS NULL THEN dd.event_date
                                  ELSE t.debit_date
                                  END             AS debit_date,
                              ot.debit_timestamp,
                              t.event_date,
                              t.account_id,
                              a.type              AS account_type,
                              t.amount,
                              t.current_balance,
                              t.source_description,
                              ot.source_details,
                              t.created_at,
                              t.updated_at,
                              ot.raw_id           AS source_id,
                              ot.reference_number AS source_reference,
                              ot.origin           AS source_origin,
                              ot.currency_rate,
                              c.is_conversion,
                              t.is_fee
    FROM accounter_schema.transactions t
            LEFT JOIN accounter_schema.transactions_raw_list rt ON t.source_id = rt.id
            LEFT JOIN accounter_schema.charges c ON c.id = t.charge_id
            LEFT JOIN accounter_schema.financial_accounts a ON a.id = t.account_id
            LEFT JOIN (SELECT isracard_creditcard_transactions.id::text                              AS raw_id,
                              COALESCE(isracard_creditcard_transactions.voucher_number::text,
                                        isracard_creditcard_transactions.voucher_number_ratz::text)   AS reference_number,
                              0                                                                      AS currency_rate,
                              NULL::timestamp without time zone                                      AS debit_timestamp,
                              'ISRACARD'::text                                                       AS origin,
                              isracard_creditcard_transactions.card                                  AS card_number,
                              COALESCE(isracard_creditcard_transactions.full_supplier_name_heb,
                                        isracard_creditcard_transactions.full_supplier_name_outbound) AS source_details
                        FROM accounter_schema.isracard_creditcard_transactions
                        UNION
                        SELECT poalim_ils_account_transactions.id::text                                AS id,
                              poalim_ils_account_transactions.reference_number::text                  AS reference_number,
                              0                                                                       AS currency_rate,
                              NULL::timestamp without time zone                                       AS debit_timestamp,
                              'POALIM'::text                                                          AS origin,
                              NULL::integer                                                           AS card_number,
                              poalim_ils_account_transactions.beneficiary_details_data_message_detail AS source_details
                        FROM accounter_schema.poalim_ils_account_transactions
                        UNION
                        SELECT poalim_eur_account_transactions.id::text               AS id,
                              poalim_eur_account_transactions.reference_number::text AS reference_number,
                              poalim_eur_account_transactions.currency_rate,
                              NULL::timestamp without time zone                      AS debit_timestamp,
                              'POALIM'::text                                         AS origin,
                              NULL::integer                                          AS card_number,
                              poalim_eur_account_transactions.event_details          AS source_details
                        FROM accounter_schema.poalim_eur_account_transactions
                        UNION
                        SELECT poalim_gbp_account_transactions.id::text               AS id,
                              poalim_gbp_account_transactions.reference_number::text AS reference_number,
                              poalim_gbp_account_transactions.currency_rate,
                              NULL::timestamp without time zone                      AS debit_timestamp,
                              'POALIM'::text                                         AS origin,
                              NULL::integer                                          AS card_number,
                              poalim_gbp_account_transactions.event_details          AS source_details
                        FROM accounter_schema.poalim_gbp_account_transactions
                        UNION
                        SELECT poalim_usd_account_transactions.id::text               AS id,
                              poalim_usd_account_transactions.reference_number::text AS reference_number,
                              poalim_usd_account_transactions.currency_rate,
                              NULL::timestamp without time zone                      AS debit_timestamp,
                              'POALIM'::text                                         AS origin,
                              NULL::integer                                          AS card_number,
                              poalim_usd_account_transactions.event_details          AS source_details
                        FROM accounter_schema.poalim_usd_account_transactions
                        UNION
                        SELECT poalim_swift_account_transactions.id::text          AS id,
                              poalim_swift_account_transactions.reference_number,
                              0,
                              NULL::timestamp without time zone                   AS debit_timestamp,
                              'POALIM'::text                                      AS origin,
                              NULL::integer                                       AS card_number,
                              poalim_swift_account_transactions.charge_party_name AS source_details
                        FROM accounter_schema.poalim_swift_account_transactions
                        UNION
                        SELECT kraken_ledger_records.ledger_id,
                              kraken_ledger_records.ledger_id,
                              CASE
                                  WHEN kraken_trades.price IS NOT NULL THEN 1::numeric / kraken_trades.price
                                  ELSE 0::numeric
                                  END                          AS currency_rate,
                              kraken_ledger_records.value_date AS debit_timestamp,
                              'KRAKEN'::text                   AS origin,
                              NULL::integer                    AS card_number,
                              NULL::character varying          AS source_details
                        FROM accounter_schema.kraken_ledger_records
                                LEFT JOIN accounter_schema.kraken_trades
                                          ON kraken_ledger_records.trade_ref_id = kraken_trades.trade_id
                        UNION
                        SELECT etana_account_transactions.transaction_id,
                              etana_account_transactions.transaction_id,
                              0,
                              NULL::timestamp without time zone AS debit_timestamp,
                              'ETANA'::text                     AS origin,
                              NULL::integer                     AS card_number,
                              NULL::character varying           AS source_details
                        FROM accounter_schema.etana_account_transactions
                        UNION
                        SELECT etherscan_transactions.id::text   AS id,
                              etherscan_transactions.transaction_hash,
                              0,
                              etherscan_transactions.event_date AS debit_timestamp,
                              'ETHERSCAN'::text                 AS origin,
                              NULL::integer                     AS card_number,
                              NULL::character varying           AS source_details
                        FROM accounter_schema.etherscan_transactions) ot ON ot.raw_id = COALESCE(rt.creditcard_id::text,
                                                                                                rt.poalim_ils_id::text,
                                                                                                rt.poalim_eur_id::text,
                                                                                                rt.poalim_gbp_id::text,
                                                                                                rt.poalim_swift_id::text,
                                                                                                rt.poalim_usd_id::text,
                                                                                                rt.kraken_id, rt.etana_id,
                                                                                                rt.etherscan_id::text)
            LEFT JOIN (SELECT p.event_date,
                              p.reference_number
                        FROM accounter_schema.poalim_ils_account_transactions p
                        WHERE p.activity_type_code = 491) dd
                      ON dd.reference_number = ot.card_number AND dd.event_date > t.event_date AND
                          dd.event_date < (t.event_date + '40 days'::interval)
    ORDER BY t.id, dd.event_date;

    create view accounter_schema.extended_charges
                (id, owner_id, is_conversion, is_property, is_salary, accountant_reviewed, user_description, created_at,
                updated_at, tax_category_id, event_amount, transactions_min_event_date, transactions_max_event_date,
                transactions_min_debit_date, transactions_max_debit_date, transactions_event_amount, transactions_currency,
                transactions_count, invalid_transactions, documents_min_date, documents_max_date, documents_event_amount,
                documents_vat_amount, documents_currency, invoices_count, receipts_count, documents_count,
                invalid_documents, business_array, business_id, can_settle_with_receipt, tags, business_trip_id,
                ledger_count, ledger_financial_entities)
    as
    SELECT c.id,
          c.owner_id,
          c.is_conversion,
          c.is_property,
          'salary'::tags = ANY (tags_table.tags_array)                                               AS is_salary,
          c.accountant_reviewed,
          c.user_description,
          c.created_at,
          c.updated_at,
          COALESCE(c.tax_category_id, tcm.tax_category_id)                                           AS tax_category_id,
          COALESCE(d.invoice_event_amount::numeric, d.receipt_event_amount::numeric, t.event_amount) AS event_amount,
          t.min_event_date                                                                           AS transactions_min_event_date,
          t.max_event_date                                                                           AS transactions_max_event_date,
          t.min_debit_date                                                                           AS transactions_min_debit_date,
          t.max_debit_date                                                                           AS transactions_max_debit_date,
          t.event_amount                                                                             AS transactions_event_amount,
          CASE
              WHEN array_length(t.currency_array, 1) = 1 THEN t.currency_array[1]
              ELSE NULL::currency
              END                                                                                    AS transactions_currency,
          t.transactions_count,
          t.invalid_transactions,
          d.min_event_date                                                                           AS documents_min_date,
          d.max_event_date                                                                           AS documents_max_date,
          COALESCE(d.invoice_event_amount, d.receipt_event_amount)                                   AS documents_event_amount,
          COALESCE(d.invoice_vat_amount, d.receipt_vat_amount)                                       AS documents_vat_amount,
          CASE
              WHEN array_length(d.currency_array, 1) = 1 THEN d.currency_array[1]
              ELSE NULL::currency
              END                                                                                    AS documents_currency,
          d.invoices_count,
          d.receipts_count,
          d.documents_count,
          d.invalid_documents,
          b2.business_array,
          b.id                                                                                       AS business_id,
          COALESCE(b.can_settle_with_receipt, false)                                                 AS can_settle_with_receipt,
          tags_table.tags_array                                                                      AS tags,
          btc.business_trip_id,
          l.ledger_count,
          l.ledger_financial_entities
    FROM accounter_schema.charges c
            LEFT JOIN (SELECT extended_transactions.charge_id,
                              min(extended_transactions.event_date)                                AS min_event_date,
                              max(extended_transactions.event_date)                                AS max_event_date,
                              min(extended_transactions.debit_date)                                AS min_debit_date,
                              max(extended_transactions.debit_date)                                AS max_debit_date,
                              sum(extended_transactions.amount)                                    AS event_amount,
                              count(*)                                                             AS transactions_count,
                              count(*) FILTER (WHERE extended_transactions.business_id IS NULL OR
                                                      extended_transactions.debit_date IS NULL) > 0 AS invalid_transactions,
                              array_agg(extended_transactions.currency)                            AS currency_array,
                              array_agg(extended_transactions.account_id)                          AS account
                        FROM accounter_schema.extended_transactions
                        GROUP BY extended_transactions.charge_id) t ON t.charge_id = c.id
            LEFT JOIN (SELECT documents.charge_id_new,
                              min(documents.date) FILTER (WHERE documents.type = ANY
                                                                (ARRAY ['INVOICE'::document_type, 'INVOICE_RECEIPT'::document_type, 'RECEIPT'::document_type])) AS min_event_date,
                              max(documents.date) FILTER (WHERE documents.type = ANY
                                                                (ARRAY ['INVOICE'::document_type, 'INVOICE_RECEIPT'::document_type, 'RECEIPT'::document_type])) AS max_event_date,
                              sum(documents.total_amount *
                                  CASE
                                      WHEN documents.creditor_id = charges.owner_id THEN 1
                                      ELSE '-1'::integer
                                      END::double precision) FILTER (WHERE businesses.can_settle_with_receipt = true AND
                                                                            (documents.type = ANY
                                                                            (ARRAY ['RECEIPT'::document_type, 'INVOICE_RECEIPT'::document_type])))              AS receipt_event_amount,
                              sum(documents.total_amount *
                                  CASE
                                      WHEN documents.creditor_id = charges.owner_id THEN 1
                                      ELSE '-1'::integer
                                      END::double precision) FILTER (WHERE documents.type = ANY
                                                                            (ARRAY ['INVOICE'::document_type, 'INVOICE_RECEIPT'::document_type]))                AS invoice_event_amount,
                              sum(documents.vat_amount *
                                  CASE
                                      WHEN documents.creditor_id = charges.owner_id THEN 1
                                      ELSE '-1'::integer
                                      END::double precision) FILTER (WHERE businesses.can_settle_with_receipt = true AND
                                                                            (documents.type = ANY
                                                                            (ARRAY ['RECEIPT'::document_type, 'INVOICE_RECEIPT'::document_type])))              AS receipt_vat_amount,
                              sum(documents.vat_amount *
                                  CASE
                                      WHEN documents.creditor_id = charges.owner_id THEN 1
                                      ELSE '-1'::integer
                                      END::double precision) FILTER (WHERE documents.type = ANY
                                                                            (ARRAY ['INVOICE'::document_type, 'INVOICE_RECEIPT'::document_type]))                AS invoice_vat_amount,
                              count(*) FILTER (WHERE documents.type = ANY
                                                      (ARRAY ['INVOICE'::document_type, 'INVOICE_RECEIPT'::document_type]))                                      AS invoices_count,
                              count(*) FILTER (WHERE documents.type = ANY
                                                      (ARRAY ['RECEIPT'::document_type, 'INVOICE_RECEIPT'::document_type]))                                      AS receipts_count,
                              count(*)                                                                                                                          AS documents_count,
                              count(*) FILTER (WHERE (documents.type = ANY
                                                      (ARRAY ['INVOICE'::document_type, 'INVOICE_RECEIPT'::document_type, 'RECEIPT'::document_type])) AND
                                                      (documents.debtor_id IS NULL OR documents.creditor_id IS NULL OR
                                                      documents.date IS NULL OR documents.serial_number IS NULL OR
                                                      documents.vat_amount IS NULL OR documents.total_amount IS NULL OR
                                                      documents.charge_id_new IS NULL OR
                                                      documents.currency_code IS NULL) OR
                                                      documents.type = 'UNPROCESSED'::document_type) >
                              0                                                                                                                                 AS invalid_documents,
                              array_agg(documents.currency_code) FILTER (WHERE
                                  businesses.can_settle_with_receipt = true AND (documents.type = ANY
                                                                                  (ARRAY ['RECEIPT'::document_type, 'INVOICE_RECEIPT'::document_type])) OR
                                  (documents.type = ANY
                                    (ARRAY ['INVOICE'::document_type, 'INVOICE_RECEIPT'::document_type])))                                                       AS currency_array
                        FROM accounter_schema.documents
                                LEFT JOIN accounter_schema.charges ON documents.charge_id_new = charges.id
                                LEFT JOIN accounter_schema.businesses ON documents.creditor_id = charges.owner_id AND
                                                                          documents.debtor_id = businesses.id OR
                                                                          documents.creditor_id = businesses.id AND
                                                                          documents.debtor_id = charges.owner_id
                        GROUP BY documents.charge_id_new) d ON d.charge_id_new = c.id
            LEFT JOIN (SELECT base.charge_id,
                              array_remove(base.business_array, charges.owner_id)          AS business_array,
                              array_remove(base.filtered_business_array, charges.owner_id) AS filtered_business_array
                        FROM (SELECT b_1.charge_id,
                                    array_agg(DISTINCT b_1.business_id)          AS business_array,
                                    array_remove(array_agg(DISTINCT
                                                            CASE
                                                                WHEN b_1.is_fee THEN NULL::uuid
                                                                ELSE b_1.business_id
                                                                END), NULL::uuid) AS filtered_business_array
                              FROM (SELECT transactions.charge_id,
                                          transactions.business_id,
                                          transactions.is_fee
                                    FROM accounter_schema.transactions
                                    WHERE transactions.business_id IS NOT NULL
                                    UNION
                                    SELECT documents.charge_id_new,
                                          documents.creditor_id,
                                          false AS bool
                                    FROM accounter_schema.documents
                                    WHERE documents.creditor_id IS NOT NULL
                                    UNION
                                    SELECT documents.charge_id_new,
                                          documents.debtor_id,
                                          false AS bool
                                    FROM accounter_schema.documents
                                    WHERE documents.debtor_id IS NOT NULL) b_1
                              GROUP BY b_1.charge_id) base
                                LEFT JOIN accounter_schema.charges ON base.charge_id = charges.id) b2
                      ON b2.charge_id = c.id
            LEFT JOIN accounter_schema.businesses b
                      ON b.id = b2.filtered_business_array[1] AND array_length(b2.filtered_business_array, 1) = 1
            LEFT JOIN accounter_schema.business_tax_category_match tcm
                      ON tcm.business_id = b.id AND tcm.owner_id = c.owner_id
            LEFT JOIN (SELECT tags_1.charge_id,
                              array_agg(tags_1.tag_name) AS tags_array
                        FROM accounter_schema.tags tags_1
                        GROUP BY tags_1.charge_id) tags_table ON c.id = tags_table.charge_id
            LEFT JOIN accounter_schema.business_trip_charges btc ON btc.charge_id = c.id
            LEFT JOIN (SELECT count(DISTINCT l2.id)                                             AS ledger_count,
                              array_remove(array_agg(DISTINCT l2.financial_entity), NULL::uuid) AS ledger_financial_entities,
                              l2.charge_id
                        FROM (SELECT ledger_records.charge_id,
                                    ledger_records.id,
                                    unnest(ARRAY [ledger_records.credit_entity1, ledger_records.credit_entity2, ledger_records.debit_entity1, ledger_records.debit_entity2]) AS financial_entity
                              FROM accounter_schema.ledger_records) l2
                        GROUP BY l2.charge_id) l ON l.charge_id = c.id;

    create function accounter_schema.update_general_updated_at() returns trigger
        language plpgsql
    as
    $$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
    $$;

    create trigger update_charge_updated_at
        after update
        on accounter_schema.charges
        for each row
    execute procedure accounter_schema.update_general_updated_at();

    create trigger update_transaction_updated_at
        after update
        on accounter_schema.transactions
        for each row
    execute procedure accounter_schema.update_general_updated_at();

    create trigger update_financial_entities_updated_at
        after update
        on accounter_schema.financial_entities
        for each row
    execute procedure accounter_schema.update_general_updated_at();

    create trigger update_ledger_records_updated_at
        after update
        on accounter_schema.ledger_records
        for each row
    execute procedure accounter_schema.update_general_updated_at();

    create function accounter_schema.insert_creditcard_transaction_handler() returns trigger
        language plpgsql
    as
    $$
    DECLARE
        merged_id UUID;
        account_id_var UUID;
        owner_id_var UUID;
        charge_id_var UUID = NULL;
    BEGIN
        -- filter summarize records
        IF (
                NEW.full_supplier_name_outbound NOT IN ('TOTAL FOR DATE', 'CASH ADVANCE FEE')
                OR NEW.full_supplier_name_outbound IS NULL
            ) AND (
                NEW.supplier_name NOT IN ('סך חיוב בש"ח:', 'סך חיוב  ב-$:')
                OR NEW.supplier_name IS NULL
            )
        THEN
            -- Create merged raw transactions record:
            INSERT INTO accounter_schema.transactions_raw_list (creditcard_id)
            VALUES (NEW.id)
            RETURNING id INTO merged_id;

            -- get account and owner IDs
            SELECT INTO account_id_var, owner_id_var
                id, owner
            FROM accounter_schema.financial_accounts
            WHERE account_number = NEW.card::TEXT;

            -- check if matching charge exists:
            -- TBD

            -- create new charge
            IF (charge_id_var IS NULL) THEN
                INSERT INTO accounter_schema.charges (owner_id, is_conversion)
                VALUES (
                    owner_id_var,
                    FALSE
                )
                RETURNING id INTO charge_id_var;
            END IF;

            -- check if new record is fee
            -- TBD

            -- check if new record contains fees
            -- TBD

            -- create new transaction
            INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency, event_date, debit_date, amount, current_balance)
            VALUES (
                account_id_var,
                charge_id_var,
                merged_id,
                CASE
                    WHEN NEW.full_supplier_name_outbound IS NULL THEN NEW.full_supplier_name_heb
                    WHEN NEW.full_supplier_name_heb IS NULL THEN (
                        COALESCE(NEW.full_supplier_name_outbound, '') ||
                        COALESCE('/' || NEW.city, '')
                    )
                END,
                CAST (
                  (
                      CASE
                          WHEN NEW.currency_id = 'ש"ח' THEN 'ILS'
                          WHEN NEW.currency_id = 'NIS' THEN 'ILS'
                          WHEN NEW.currency_id = 'דולר' THEN 'USD'
                          WHEN NEW.currency_id = 'USD' THEN 'USD'
                          WHEN NEW.currency_id = 'EUR' THEN 'EUR'
                          WHEN NEW.currency_id = 'GBP' THEN 'GBP'
                          -- use ILS as default:
                          ELSE 'ILS' END
                    ) as currency
                ),
                CASE
                    WHEN NEW.full_purchase_date IS NULL THEN to_date(NEW.full_purchase_date_outbound, 'DD/MM/YYYY')
                    WHEN NEW.full_purchase_date_outbound IS NULL THEN to_date(NEW.full_purchase_date, 'DD/MM/YYYY')
                END,
                to_date(COALESCE(NEW.full_payment_date, NEW.charging_date), 'DD/MM/YYYY'),
                CASE
                    WHEN NEW.payment_sum IS NULL THEN (NEW.payment_sum_outbound * -1)
                    WHEN NEW.payment_sum_outbound IS NULL THEN (NEW.payment_sum * -1)
                END,
                0
            );
        END IF;

        RETURN NEW;
    END;
    $$;

    create trigger isracard_transaction_insert_trigger
        after insert
        on accounter_schema.isracard_creditcard_transactions
        for each row
    execute procedure accounter_schema.insert_creditcard_transaction_handler();

    create function accounter_schema.insert_poalim_eur_transaction_handler() returns trigger
        language plpgsql
    as
    $$
    DECLARE
        merged_id UUID;
        account_id_var UUID;
        owner_id_var UUID;
        charge_id_var UUID = NULL;
        is_conversion BOOLEAN = false;
        is_fee BOOLEAN = false;
    BEGIN
        -- Create merged raw transactions record:
        INSERT INTO accounter_schema.transactions_raw_list (poalim_eur_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- get account and owner IDs
        SELECT INTO account_id_var, owner_id_var
            id, owner
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account_number::TEXT;

        -- handle conversions
        IF (new.activity_type_code in (884, 957,1058)) THEN
            is_conversion = true;

            -- check if matching charge exists:
            SELECT t.charge_id
            INTO charge_id_var
            FROM (
                SELECT 'usd' AS currency, id, reference_number, reference_catenated_number, value_date, event_amount FROM accounter_schema.poalim_usd_account_transactions
                WHERE activity_type_code IN (884, 957,1058)
                UNION
                SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount FROM accounter_schema.poalim_gbp_account_transactions
                WHERE activity_type_code IN (884, 957,1058)
                UNION
                SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount FROM accounter_schema.poalim_ils_account_transactions
                WHERE text_code IN (22, 23)) AS s
            LEFT JOIN accounter_schema.transactions_raw_list tr
            ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id) = s.id
            LEFT JOIN accounter_schema.transactions t
            ON tr.id = t.source_id
            WHERE t.charge_id IS NOT NULL
            AND s.reference_number = NEW.reference_number
            AND s.reference_catenated_number = NEW.reference_catenated_number
            AND s.value_date = NEW.value_date;

            -- update charge's tag to 'conversion'
            IF (charge_id_var IS NOT NULL) THEN
                INSERT INTO accounter_schema.tags (charge_id, tag_name)
                VALUES (charge_id_var, 'conversion')
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;

        -- if no match, create new charge
        IF (charge_id_var IS NULL) THEN
            INSERT INTO accounter_schema.charges (owner_id, is_conversion)
            VALUES (
                owner_id_var,
                is_conversion
            )
            RETURNING id INTO charge_id_var;
        END IF;

        -- check if new record is fee
        IF (new.activity_type_code = 1279 AND new.event_amount BETWEEN 0 AND 30)
        THEN is_fee = true;
        END IF;

        -- check if new record contains fees
        -- TBD

        -- create new transaction
        INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency, event_date, debit_date, amount, current_balance, is_fee)
        VALUES (
            account_id_var,
            charge_id_var,
            merged_id,
            concat(
                new.activity_description,
                ' ',
                coalesce(new.event_details, ''),
                ' ',
                coalesce(new.account_name, '')
            ),
            'EUR',
            new.executing_date::text::date,
            new.value_date::text::date,
            (CASE
                WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                ELSE new.event_amount END
            ),
            new.current_balance,
            is_fee
        );

        RETURN NEW;
    END;
    $$;

    create trigger eur_transaction_insert_trigger
        after insert
        on accounter_schema.poalim_eur_account_transactions
        for each row
    execute procedure accounter_schema.insert_poalim_eur_transaction_handler();

    create function accounter_schema.insert_poalim_gbp_transaction_handler() returns trigger
        language plpgsql
    as
    $$
    DECLARE
        merged_id UUID;
        account_id_var UUID;
        owner_id_var UUID;
        charge_id_var UUID = NULL;
        is_conversion BOOLEAN = false;
        is_fee BOOLEAN = false;
    BEGIN
        -- Create merged raw transactions record:
        INSERT INTO accounter_schema.transactions_raw_list (poalim_gbp_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- get account and owner IDs
        SELECT INTO account_id_var, owner_id_var
            id, owner
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account_number::TEXT;

        -- handle conversions
        IF (new.activity_type_code IN (884, 957,1058)) THEN
            is_conversion = true;

            -- check if matching charge exists:
            SELECT t.charge_id
            INTO charge_id_var
            FROM (
                SELECT 'usd' AS currency, id, reference_number, reference_catenated_number, value_date, event_amount FROM accounter_schema.poalim_usd_account_transactions
                WHERE activity_type_code IN (884, 957,1058)
                UNION
                SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount FROM accounter_schema.poalim_eur_account_transactions
                WHERE activity_type_code IN (884, 957,1058)
                UNION
                SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount FROM accounter_schema.poalim_ils_account_transactions
                WHERE text_code IN (22, 23)) AS s
            LEFT JOIN accounter_schema.transactions_raw_list tr
            ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id) = s.id
            LEFT JOIN accounter_schema.transactions t
            ON tr.id = t.source_id
            WHERE t.charge_id IS NOT NULL
            AND s.reference_number = NEW.reference_number
            AND s.reference_catenated_number = NEW.reference_catenated_number
            AND s.value_date = NEW.value_date;

            -- update charge's tag to 'conversion'
            IF (charge_id_var IS NOT NULL) THEN
                INSERT INTO accounter_schema.tags (charge_id, tag_name)
                VALUES (charge_id_var, 'conversion')
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;

        -- if no match, create new charge
        IF (charge_id_var IS NULL) THEN
            INSERT INTO accounter_schema.charges (owner_id, is_conversion)
            VALUES (
                owner_id_var,
                is_conversion
            )
            RETURNING id INTO charge_id_var;
        END IF;

        -- check if new record is fee
        IF (new.activity_type_code = 1279 AND new.event_amount BETWEEN 0 AND 30)
        THEN is_fee = true;
        END IF;

        -- check if new record contains fees
        -- TBD

        -- create new transaction
        INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency, event_date, debit_date, amount, current_balance, is_fee)
        VALUES (
            account_id_var,
            charge_id_var,
            merged_id,
            concat(
                new.activity_description,
                ' ',
                coalesce(new.event_details, ''),
                ' ',
                coalesce(new.account_name, '')
            ),
            'GBP',
            new.executing_date::text::date,
            new.value_date::text::date,
            (CASE
                WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                ELSE new.event_amount END
            ),
            new.current_balance,
            is_fee
        );

        RETURN NEW;
    END;
    $$;

    create trigger gbp_transaction_insert_trigger
        after insert
        on accounter_schema.poalim_gbp_account_transactions
        for each row
    execute procedure accounter_schema.insert_poalim_gbp_transaction_handler();

    create function accounter_schema.insert_poalim_ils_transaction_handler() returns trigger
        language plpgsql
    as
    $$
    DECLARE
        merged_id UUID;
        account_id_var UUID;
        owner_id_var UUID;
        charge_id_var UUID = NULL;
        is_conversion BOOLEAN = false;
        is_fee BOOLEAN = false;
    BEGIN
        -- Create merged raw transactions record:
        INSERT INTO accounter_schema.transactions_raw_list (poalim_ils_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- get account and owner IDs
        SELECT INTO account_id_var, owner_id_var
            id, owner
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account_number::TEXT;

        -- handle conversions
        IF (new.activity_type_code IN (22,23)) THEN
            is_conversion = true;

            -- check if matching charge exists:
            SELECT t.charge_id
            INTO charge_id_var
            FROM (
                SELECT 'usd' AS currency, id, reference_number, reference_catenated_number, value_date, event_amount FROM accounter_schema.poalim_usd_account_transactions
                WHERE activity_type_code IN (884, 957,1058)
                UNION
                SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount FROM accounter_schema.poalim_eur_account_transactions
                WHERE activity_type_code IN (884, 957,1058)
                UNION
                SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount FROM accounter_schema.poalim_gbp_account_transactions
                WHERE activity_type_code IN (884, 957,1058)) AS s
            LEFT JOIN accounter_schema.transactions_raw_list tr
            ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id) = s.id
            LEFT JOIN accounter_schema.transactions t
            ON tr.id = t.source_id
            WHERE t.charge_id IS NOT NULL
            AND s.reference_number = NEW.reference_number
            AND s.reference_catenated_number = NEW.reference_catenated_number
            AND s.value_date = NEW.value_date;

            -- update charge's tag to 'conversion'
            IF (charge_id_var IS NOT NULL) THEN
                INSERT INTO accounter_schema.tags (charge_id, tag_name)
                VALUES (charge_id_var, 'conversion')
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;

        -- if no match, create new charge
        IF (charge_id_var IS NULL) THEN
            INSERT INTO accounter_schema.charges (owner_id, is_conversion)
            VALUES (
                owner_id_var,
                is_conversion
            )
            RETURNING id INTO charge_id_var;
        END IF;

        -- check if new record is fee
        IF (
            (new.activity_type_code = 452 AND new.text_code IN (105, 547))
                OR (new.activity_type_code = 473 AND new.text_code IN (378, 395, 437, 502, 602, 603, 716, 771, 774))
        ) THEN
            is_fee = true;
        END IF;

        -- check if new record contains fees
        -- TBD

        -- create new transaction
        INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency, event_date, debit_date, amount, current_balance, is_fee)
        VALUES (
            account_id_var,
            charge_id_var,
            merged_id,
            concat(
                new.activity_description,
                ' ',
                coalesce(new.beneficiary_details_data_party_name, ''),
                ' ',
                coalesce(new.beneficiary_details_data_message_detail, ''),
                ' ',
                coalesce(new.english_action_desc, '')
            ),
            'ILS',
            new.event_date::text::date,
            new.event_date::text::date,
            (CASE
                WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                ELSE new.event_amount END
            ),
            new.current_balance,
            is_fee
        );

        RETURN NEW;
    END;
    $$;

    create trigger ils_transaction_insert_trigger
        after insert
        on accounter_schema.poalim_ils_account_transactions
        for each row
    execute procedure accounter_schema.insert_poalim_ils_transaction_handler();

    create function accounter_schema.insert_poalim_swift_transaction_handler() returns trigger
        language plpgsql
    as
    $$
    DECLARE
        merged_id UUID;
        account_id_var UUID;
        owner_id_var UUID;
        charge_id_var UUID = NULL;
        transaction_amount NUMERIC;
        fee_amount NUMERIC;
        currency_code CURRENCY;
    BEGIN
        transaction_amount := REPLACE(RIGHT(NEW.swift_currency_instructed_amount_33b, LENGTH(NEW.swift_currency_instructed_amount_33b) - 3), ',', '.')::NUMERIC;
        fee_amount := transaction_amount - REPLACE(RIGHT(NEW.swift_value_date_currency_amount_32a, LENGTH(NEW.swift_value_date_currency_amount_32a) - 9), ',', '.')::NUMERIC;
        currency_code := LEFT(NEW.swift_currency_instructed_amount_33b, 3)::CURRENCY;

        IF (fee_amount > 0) THEN
            -- Create merged raw transactions record:
            INSERT INTO accounter_schema.transactions_raw_list (poalim_swift_id)
            VALUES (NEW.id)
            RETURNING id INTO merged_id;

            -- get account and owner IDs
            SELECT INTO account_id_var, owner_id_var
                id, owner
            FROM accounter_schema.financial_accounts
            WHERE account_number = NEW.account_number::TEXT;

            -- check if matching charge exists for source:
            SELECT t.charge_id
            INTO charge_id_var
            FROM (
                SELECT formatted_value_date, event_details, id, 'GBP' as currency, event_amount FROM accounter_schema.poalim_gbp_account_transactions
                UNION
                SELECT formatted_value_date, event_details, id, 'EUR', event_amount FROM accounter_schema.poalim_eur_account_transactions
                UNION
                SELECT formatted_value_date, event_details, id, 'USD', event_amount FROM accounter_schema.poalim_usd_account_transactions
            ) AS s
            LEFT JOIN accounter_schema.transactions_raw_list tr
            ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id) = s.id
            LEFT JOIN accounter_schema.transactions t
            ON tr.id = t.source_id
            WHERE t.charge_id IS NOT NULL
                    AND (s.formatted_value_date = NEW.formatted_start_date
                        OR s.formatted_value_date = NEW.formatted_start_date)
                    AND currency_code::text = s.currency
                    AND (s.event_details LIKE '%' || TRIM(LEFT(NEW.charge_party_name, 13)) || '%'
                        AND NEW.amount::NUMERIC = s.event_amount)
                    OR (transaction_amount * -1 = s.event_amount);

            -- if no match, create new charge
            IF (charge_id_var IS NULL) THEN
                INSERT INTO accounter_schema.charges (owner_id)
                VALUES (
                    owner_id_var
                )
                RETURNING id INTO charge_id_var;
            END IF;

            -- create new transaction for fee
            INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency, event_date, debit_date, amount, current_balance, business_id, is_fee)
            VALUES (
                account_id_var,
                charge_id_var,
                merged_id,
                CONCAT_WS(' ',
                    'Swift Fee:',
                    NEW.charge_party_name,
                    NEW.reference_number
                ),
                currency_code,
                NEW.formatted_start_date::DATE,
                new.formatted_start_date::DATE,
                fee_amount * -1,
                0,
                NULL,
                TRUE
            );
        END IF;
        RETURN NEW;
    END;
    $$;

    create trigger swift_transaction_insert_trigger
        after insert
        on accounter_schema.poalim_swift_account_transactions
        for each row
    execute procedure accounter_schema.insert_poalim_swift_transaction_handler();

    create function accounter_schema.insert_poalim_usd_transaction_handler() returns trigger
        language plpgsql
    as
    $$
    DECLARE
        merged_id UUID;
        account_id_var UUID;
        owner_id_var UUID;
        charge_id_var UUID = NULL;
        is_conversion BOOLEAN = false;
        is_fee BOOLEAN = false;
    BEGIN
        -- Create merged raw transactions record:
        INSERT INTO accounter_schema.transactions_raw_list (poalim_usd_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- get account and owner IDs
        SELECT INTO account_id_var, owner_id_var
            id, owner
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account_number::TEXT;

        -- handle conversions
        IF (new.activity_type_code IN (884, 957,1058)) THEN
            is_conversion = true;

            -- check if matching charge exists:
            SELECT t.charge_id
            INTO charge_id_var
            FROM (
                SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount FROM accounter_schema.poalim_eur_account_transactions
                WHERE activity_type_code IN (884, 957,1058)
                UNION
                SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount FROM accounter_schema.poalim_gbp_account_transactions
                WHERE activity_type_code IN (884, 957,1058)
                UNION
                SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount FROM accounter_schema.poalim_ils_account_transactions
                WHERE text_code IN (22, 23)) AS s
            LEFT JOIN accounter_schema.transactions_raw_list tr
            ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id) = s.id
            LEFT JOIN accounter_schema.transactions t
            ON tr.id = t.source_id
            WHERE t.charge_id IS NOT NULL
            AND s.reference_number = NEW.reference_number
            AND s.reference_catenated_number = NEW.reference_catenated_number
            AND s.value_date = NEW.value_date;

            -- update charge's tag to 'conversion'
            IF (charge_id_var IS NOT NULL) THEN
                INSERT INTO accounter_schema.tags (charge_id, tag_name)
                VALUES (charge_id_var, 'conversion')
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;

        -- if no match, create new charge
        IF (charge_id_var IS NULL) THEN
            INSERT INTO accounter_schema.charges (owner_id, is_conversion)
            VALUES (
                owner_id_var,
                is_conversion
            )
            RETURNING id INTO charge_id_var;
        END IF;

        -- check if new record is fee
        IF (new.activity_type_code = 1279 AND new.event_amount BETWEEN 0 AND 30)
        THEN is_fee = true;
        END IF;

        -- check if new record contains fees
        -- TBD

        -- create new transaction
        INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency, event_date, debit_date, amount, current_balance, is_fee)
        VALUES (
            account_id_var,
            charge_id_var,
            merged_id,
            concat(
                new.activity_description,
                ' ',
                coalesce(new.event_details, ''),
                ' ',
                coalesce(new.account_name, '')
            ),
            'USD',
            new.executing_date::text::date,
            new.value_date::text::date,
            (CASE
                WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                ELSE new.event_amount END
            ),
            new.current_balance,
            is_fee
        );

        RETURN NEW;
    END;
    $$;

    create trigger usd_transaction_insert_trigger
        after insert
        on accounter_schema.poalim_usd_account_transactions
        for each row
    execute procedure accounter_schema.insert_poalim_usd_transaction_handler();
`,
} satisfies MigrationExecutor;
