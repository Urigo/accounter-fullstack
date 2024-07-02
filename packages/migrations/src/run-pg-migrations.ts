import { type DatabasePool } from 'slonik';
import migration_2024_01_29T13_15_23_initial from './actions/2024-01-29T13-15-23.initial.js';
import migration_2024_02_22T21_37_11_charge_year_of_relevance from './actions/2024-02-22T21-37-11.charge-year-of-relevance.js';
import migration_2024_02_26T11_01_45_centralize_financial_entities_shared_columns from './actions/2024-02-26T11-01-45.centralize-financial-entities-shared-columns.js';
import migration_2024_03_17T23_10_10_filter_distinct_transactions_currencies_on_charge from './actions/2024-03-17T23-10-10.filter-distinct-transactions-currencies-on-charge.js';
import migration_2024_03_18T17_29_15_convert_charges_year_to_years_of_relevance from './actions/2024-03-18T17-29-15.convert-charges-year-to-years-of-relevance.js';
import migration_2024_03_21T11_54_00_exempt_dealers_business_flag from './actions/2024-03-21T11-54-00.exempt-dealers-business-flag.js';
import migration_2024_03_21T15_33_43_transactions_extension_tables from './actions/2024-03-21T15-33-43.transactions-extension-tables.js';
import migration_2024_03_31T11_01_12_flight_class_type from './actions/2024-03-31T11-01-12.flight-class-type.js';
import migration_2024_04_01T17_36_20_extend_charges_business_array_with_ledger from './actions/2024-04-01T17-36-20.extend-charges-business-array-with-ledger.js';
import migration_2024_04_10T15_04_24_business_trips_attendees_dates from './actions/2024-04-10T15-04-24.business-trips-attendees-dates.js';
import migration_2024_05_15T10_23_55_creditcard_trigger_better_filtering from './actions/2024-05-15T10-23-55.creditcard-trigger-better-filtering.js';
import migration_2024_05_15T21_55_55_creditcard_trigger_better_filtering2 from './actions/2024-05-15T21-55-55.creditcard-trigger-better-filtering2.js';
import migration_2024_05_19T13_36_34_fix_updated_at_triggers from './actions/2024-05-19T13-36-34.fix-updated-at-triggers.js';
import migration_2024_05_21T19_06_42_refactor_financial_accounts from './actions/2024-05-21T19-06-42.refactor-financial-accounts.js';
import migration_2024_05_27T16_21_23_better_handle_credit_invoices from './actions/2024-05-27T16-21-23.better-handle-credit-invoices.js';
import migration_2024_05_28T15_33_03_add_currency_diff_flag_to_charges from './actions/2024-05-28T15-33-03.add-currency-diff-flag-to-charges.js';
import migration_2024_06_14T10_42_35_onboarding_new_user_adjustments from './actions/2024-06-14T10-42-35.onboarding-new-user-adjustments.js';
import migration_2024_06_19T17_41_45_drop_balance_cancellation_limitation from './actions/2024-06-19T17-41-45.drop-balance-cancellation-limitation.js';
import migration_2024_06_19T21_28_12_improve_credit_invoice_document_handling from './actions/2024-06-19T21-28-12.improve-credit-invoice-document-handling.js';
import migration_2024_06_26T09_03_58_ignore_zero_amount_isracard_transactions from './actions/2024-06-26T09-03-58.ignore-zero-amount-isracard-transactions.js';
import migration_2024_06_26T16_19_27_transactions_debit_date_override from './actions/2024-06-26T16-19-27.transactions-debit-date-override.js';
import migration_2024_06_28T14_06_52_charge_type_column from './actions/2024-06-28T14-06-52.charge-type-column.js';
import migration_2024_06_29T17_52_10_refactor_tags from './actions/2024-06-29T17-52-10.refactor-tags.js';
import migration_2024_07_02T15_31_30_extended_charges_include_ledger_dates from './actions/2024-07-02T15-31-30.extended-charges-include-ledger-dates.js';
import { runMigrations } from './pg-migrator.js';

export const runPGMigrations = (args: { slonik: DatabasePool }) =>
  runMigrations({
    slonik: args.slonik,
    migrations: [
      migration_2024_01_29T13_15_23_initial,
      migration_2024_02_22T21_37_11_charge_year_of_relevance,
      migration_2024_02_26T11_01_45_centralize_financial_entities_shared_columns,
      migration_2024_03_17T23_10_10_filter_distinct_transactions_currencies_on_charge,
      migration_2024_03_18T17_29_15_convert_charges_year_to_years_of_relevance,
      migration_2024_03_21T11_54_00_exempt_dealers_business_flag,
      migration_2024_03_21T15_33_43_transactions_extension_tables,
      migration_2024_03_31T11_01_12_flight_class_type,
      migration_2024_04_01T17_36_20_extend_charges_business_array_with_ledger,
      migration_2024_04_10T15_04_24_business_trips_attendees_dates,
      migration_2024_05_15T10_23_55_creditcard_trigger_better_filtering,
      migration_2024_05_15T21_55_55_creditcard_trigger_better_filtering2,
      migration_2024_05_19T13_36_34_fix_updated_at_triggers,
      migration_2024_05_21T19_06_42_refactor_financial_accounts,
      migration_2024_05_27T16_21_23_better_handle_credit_invoices,
      migration_2024_05_28T15_33_03_add_currency_diff_flag_to_charges,
      migration_2024_06_14T10_42_35_onboarding_new_user_adjustments,
      migration_2024_06_19T17_41_45_drop_balance_cancellation_limitation,
      migration_2024_06_19T21_28_12_improve_credit_invoice_document_handling,
      migration_2024_06_26T09_03_58_ignore_zero_amount_isracard_transactions,
      migration_2024_06_26T16_19_27_transactions_debit_date_override,
      migration_2024_06_28T14_06_52_charge_type_column,
      migration_2024_06_29T17_52_10_refactor_tags,
      migration_2024_07_02T15_31_30_extended_charges_include_ledger_dates,
    ],
  });
