import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-01-14T18-59-26.add-user-context-table.sql',
  run: ({ sql }) => sql`
create table if not exists accounter_schema.user_context
(
    owner_id                                        uuid                                                               not null
        constraint user_context_pk
            primary key
        constraint user_context_businesses_id_fk_18
            references accounter_schema.businesses,
    default_local_currency                          accounter_schema.currency default 'ILS'::accounter_schema.currency not null,
    default_fiat_currency_for_crypto_conversions    accounter_schema.currency default 'USD'::accounter_schema.currency not null,
    default_tax_category_id                         uuid                                                               not null
        constraint user_context_tax_categories_id_fk
            references accounter_schema.tax_categories,
    vat_business_id                                 uuid                                                               not null
        constraint user_context_businesses_id_fk
            references accounter_schema.businesses,
    input_vat_tax_category_id                       uuid                                                               not null
        constraint user_context_tax_categories_id_fk_2
            references accounter_schema.tax_categories,
    output_vat_tax_category_id                      uuid                                                               not null
        constraint user_context_tax_categories_id_fk_3
            references accounter_schema.tax_categories,
    tax_business_id                                 uuid                                                               not null
        constraint user_context_businesses_id_fk_2
            references accounter_schema.businesses,
    tax_expenses_tax_category_id                    uuid                                                               not null
        constraint user_context_tax_categories_id_fk_4
            references accounter_schema.tax_categories,
    social_security_business_id                     uuid                                                               not null
        constraint user_context_businesses_id_fk_3
            references accounter_schema.businesses,
    exchange_rate_tax_category_id                   uuid                                                               not null
        constraint user_context_tax_categories_id_fk_5
            references accounter_schema.tax_categories,
    income_exchange_rate_tax_category_id            uuid                                                               not null
        constraint user_context_tax_categories_id_fk_6
            references accounter_schema.tax_categories,
    exchange_rate_revaluation_tax_category_id       uuid                                                               not null
        constraint user_context_tax_categories_id_fk_7
            references accounter_schema.tax_categories,
    fee_tax_category_id                             uuid                                                               not null
        constraint user_context_tax_categories_id_fk_8
            references accounter_schema.tax_categories,
    general_fee_tax_category_id                     uuid                                                               not null
        constraint user_context_tax_categories_id_fk_9
            references accounter_schema.tax_categories,
    fine_tax_category_id                            uuid                                                               not null
        constraint user_context_tax_categories_id_fk_10
            references accounter_schema.tax_categories,
    untaxable_gifts_tax_category_id                 uuid                                                               not null
        constraint user_context_tax_categories_id_fk_11
            references accounter_schema.tax_categories,
    balance_cancellation_tax_category_id            uuid                                                               not null
        constraint user_context_tax_categories_id_fk_12
            references accounter_schema.tax_categories,
    development_foreign_tax_category_id             uuid                                                               not null
        constraint user_context_tax_categories_id_fk_13
            references accounter_schema.tax_categories,
    development_local_tax_category_id               uuid                                                               not null
        constraint user_context_tax_categories_id_fk_14
            references accounter_schema.tax_categories,
    accumulated_depreciation_tax_category_id        uuid
        constraint user_context_tax_categories_id_fk_15
            references accounter_schema.tax_categories,
    rnd_depreciation_expenses_tax_category_id       uuid
        constraint user_context_tax_categories_id_fk_16
            references accounter_schema.tax_categories,
    gnm_depreciation_expenses_tax_category_id       uuid
        constraint user_context_tax_categories_id_fk_17
            references accounter_schema.tax_categories,
    marketing_depreciation_expenses_tax_category_id uuid
        constraint user_context_tax_categories_id_fk_18
            references accounter_schema.tax_categories,
    bank_deposit_interest_income_tax_category_id    uuid
        constraint user_context_tax_categories_id_fk_19
            references accounter_schema.tax_categories,
    business_trip_tax_category_id                   uuid
        constraint user_context_tax_categories_id_fk_20
            references accounter_schema.tax_categories,
    business_trip_tag_id                            uuid
        constraint user_context_tags_id_fk
            references accounter_schema.tags,
    expenses_to_pay_tax_category_id                 uuid                                                               not null
        constraint user_context_tax_categories_id_fk_21
            references accounter_schema.tax_categories,
    expenses_in_advance_tax_category_id             uuid                                                               not null
        constraint user_context_tax_categories_id_fk_22
            references accounter_schema.tax_categories,
    income_to_collect_tax_category_id               uuid                                                               not null
        constraint user_context_tax_categories_id_fk_23
            references accounter_schema.tax_categories,
    income_in_advance_tax_category_id               uuid
        constraint user_context_tax_categories_id_fk_24
            references accounter_schema.tax_categories,
    zkufot_expenses_tax_category_id                 uuid
        constraint user_context_tax_categories_id_fk_25
            references accounter_schema.tax_categories,
    zkufot_income_tax_category_id                   uuid
        constraint user_context_tax_categories_id_fk_26
            references accounter_schema.tax_categories,
    social_security_expenses_tax_category_id        uuid
        constraint user_context_tax_categories_id_fk_27
            references accounter_schema.tax_categories,
    salary_expenses_tax_category_id                 uuid
        constraint user_context_tax_categories_id_fk_28
            references accounter_schema.tax_categories,
    training_fund_expenses_tax_category_id          uuid
        constraint user_context_tax_categories_id_fk_29
            references accounter_schema.tax_categories,
    pension_fund_expenses_tax_category_id           uuid
        constraint user_context_tax_categories_id_fk_30
            references accounter_schema.tax_categories,
    compensation_fund_expenses_tax_category_id      uuid
        constraint user_context_tax_categories_id_fk_31
            references accounter_schema.tax_categories,
    batched_employees_business_id                   uuid
        constraint user_context_businesses_id_fk_4
            references accounter_schema.businesses,
    batched_funds_business_id                       uuid
        constraint user_context_businesses_id_fk_5
            references accounter_schema.businesses,
    tax_deductions_business_id                      uuid
        constraint user_context_businesses_id_fk_6
            references accounter_schema.businesses,
    recovery_reserve_expenses_tax_category_id       uuid
        constraint user_context_tax_categories_id_fk_32
            references accounter_schema.tax_categories,
    recovery_reserve_tax_category_id                uuid
        constraint user_context_tax_categories_id_fk_33
            references accounter_schema.tax_categories,
    vacation_reserve_expenses_tax_category_id       uuid
        constraint user_context_tax_categories_id_fk_34
            references accounter_schema.tax_categories,
    vacation_reserve_tax_category_id                uuid
        constraint user_context_tax_categories_id_fk_35
            references accounter_schema.tax_categories,
    poalim_business_id                              uuid
        constraint user_context_businesses_id_fk_7
            references accounter_schema.businesses,
    discount_business_id                            uuid
        constraint user_context_businesses_id_fk_8
            references accounter_schema.businesses,
    isracard_business_id                            uuid
        constraint user_context_businesses_id_fk_9
            references accounter_schema.businesses,
    amex_business_id                                uuid
        constraint user_context_businesses_id_fk_10
            references accounter_schema.businesses,
    cal_business_id                                 uuid
        constraint user_context_businesses_id_fk_11
            references accounter_schema.businesses,
    etana_business_id                               uuid
        constraint user_context_businesses_id_fk_12
            references accounter_schema.businesses,
    kraken_business_id                              uuid
        constraint user_context_businesses_id_fk_13
            references accounter_schema.businesses,
    etherscan_business_id                           uuid
        constraint user_context_businesses_id_fk_14
            references accounter_schema.businesses,
    swift_business_id                               uuid
        constraint user_context_businesses_id_fk_15
            references accounter_schema.businesses,
    bank_deposit_business_id                        uuid
        constraint user_context_businesses_id_fk_16
            references accounter_schema.businesses,
    dividend_withholding_tax_business_id            uuid
        constraint user_context_businesses_id_fk_17
            references accounter_schema.businesses,
    dividend_tax_category_id                        uuid
        constraint user_context_tax_categories_id_fk_36
            references accounter_schema.tax_categories
);

create unique index if not exists user_context_owner_id_uindex
    on accounter_schema.user_context (owner_id);
`,
} satisfies MigrationExecutor;
