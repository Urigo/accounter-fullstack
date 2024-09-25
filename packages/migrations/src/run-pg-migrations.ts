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
import migration_2024_07_03T17_09_04_extended_charge_type_enum from './actions/2024-07-03T17-09-04.extended-charge-type-enum.js';
import migration_2024_07_08T17_37_01_authorities_misc_expenses from './actions/2024-07-08T17-37-01.authorities-misc-expenses.js';
import migration_2024_07_15T16_22_59_documents_table_reorder from './actions/2024-07-15T16-22-59.documents-table-reorder.js';
import migration_2024_07_18T13_43_02_enhance_charge_spreading from './actions/2024-07-18T13-43-02.enhance-charge-spreading.js';
import migration_2024_07_23T12_58_43_edit_charge_type_enum1 from './actions/2024-07-23T12-58-43.edit-charge-type-enum1.js';
import migration_2024_07_23T12_58_43_edit_charge_type_enum2 from './actions/2024-07-23T12-58-43.edit-charge-type-enum2.js';
import migration_2024_07_25T14_10_36_enhance_view_tables from './actions/2024-07-25T14-10-36.enhance-view-tables.js';
import migration_2024_07_25T22_38_12_charge_type_fixes from './actions/2024-07-25T22-38-12.charge-type-fixes.js';
import migration_2024_07_29T12_40_02_enhance_business_trip_employee_payments from './actions/2024-07-29T12-40-02.enhance-business-trip-employee-payments.js';
import migration_2024_08_01T09_01_35_transaction_view_debit_date_fix from './actions/2024-08-01T09-01-35.transaction-view-debit-date-fix.js';
import migration_2024_08_04T12_37_14_add_document_type_other from './actions/2024-08-04T12-37-14.add-document-type-other.js';
import migration_2024_08_06T08_47_51_business_trip_accountant_approval from './actions/2024-08-06T08-47-51.business-trip-accountant-approval.js';
import migration_2024_08_06T14_00_00_add_description_to_business_trip_other_transaction from './actions/2024-08-06T14-00-00.add-description-to-business-trip-other-transaction.js';
import migration_2024_08_06T15_00_00_enhance_business_trip_transactions_matching from './actions/2024-08-06T15-00-00.enhance-business-trip-transactions-matching.js';
import migration_2024_08_12T09_53_52_fix_business_trip_transactions_view from './actions/2024-08-12T09-53-52.fix-business-trip-transactions-view.js';
import migration_2024_08_12T17_21_10_optional_vat_flag from './actions/2024-08-12T17-21-10.optional-vat-flag.js';
import migration_2024_08_13T12_57_25_attendees_info_for_trip_accommodation_flights_expenses from './actions/2024-08-13T12-57-25.attendees-info-for-trip-accommodation-flights-expenses.js';
import migration_2024_08_19T18_05_19_enhance_accountant_approval from './actions/2024-08-19T18-05-19.enhance-accountant-approval.js';
import migration_2024_08_20T13_14_01_business_trip_transaction_match_amount_fix from './actions/2024-08-20T13-14-01.business-trip-transaction-match-amount-fix.js';
import migration_2024_08_25T12_46_25_add_owner_to_extended_transactions from './actions/2024-08-25T12-46-25.add-owner-to-extended-transactions.js';
import migration_2024_08_25T15_11_15_business_trip_tax_variables from './actions/2024-08-25T15-11-15.business-trip-tax-variables.js';
import migration_2024_08_27T14_53_58_update_misc_transactions_amount_type from './actions/2024-08-27T14-53-58.update-misc-transactions-amount-type.js';
import migration_2024_08_28T12_03_04_business_trip_car_rental_category from './actions/2024-08-28T12-03-04.business-trip-car-rental-category.js';
import migration_2024_08_28T16_07_43_deprecation from './actions/2024-08-28T16-07-43.deprecation.js';
import migration_2024_09_01T13_30_24_business_trip_transactions_view_fix from './actions/2024-09-01T13-30-24.business-trip-transactions-view-fix.js';
import migration_2024_09_04T15_37_43_company_taxes from './actions/2024-09-04T15-37-43.company-taxes.js';
import migration_2024_09_04T18_34_03_vat_report_date_override from './actions/2024-09-04T18-34-03.vat-report-date-override.js';
import migration_2024_09_05T15_51_41_depreciation from './actions/2024-09-05T15-51-41.depreciation.js';
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
      migration_2024_07_03T17_09_04_extended_charge_type_enum,
      migration_2024_07_08T17_37_01_authorities_misc_expenses,
      migration_2024_07_15T16_22_59_documents_table_reorder,
      migration_2024_07_18T13_43_02_enhance_charge_spreading,
      migration_2024_07_23T12_58_43_edit_charge_type_enum1,
      migration_2024_07_23T12_58_43_edit_charge_type_enum2,
      migration_2024_07_25T14_10_36_enhance_view_tables,
      migration_2024_07_25T22_38_12_charge_type_fixes,
      migration_2024_07_29T12_40_02_enhance_business_trip_employee_payments,
      migration_2024_08_01T09_01_35_transaction_view_debit_date_fix,
      migration_2024_08_04T12_37_14_add_document_type_other,
      migration_2024_08_06T08_47_51_business_trip_accountant_approval,
      migration_2024_08_06T14_00_00_add_description_to_business_trip_other_transaction,
      migration_2024_08_06T15_00_00_enhance_business_trip_transactions_matching,
      migration_2024_08_12T09_53_52_fix_business_trip_transactions_view,
      migration_2024_08_12T17_21_10_optional_vat_flag,
      migration_2024_08_13T12_57_25_attendees_info_for_trip_accommodation_flights_expenses,
      migration_2024_08_19T18_05_19_enhance_accountant_approval,
      migration_2024_08_20T13_14_01_business_trip_transaction_match_amount_fix,
      migration_2024_08_25T12_46_25_add_owner_to_extended_transactions,
      migration_2024_08_25T15_11_15_business_trip_tax_variables,
      migration_2024_08_27T14_53_58_update_misc_transactions_amount_type,
      migration_2024_08_28T12_03_04_business_trip_car_rental_category,
      migration_2024_08_28T16_07_43_deprecation,
      migration_2024_09_01T13_30_24_business_trip_transactions_view_fix,
      migration_2024_09_04T15_37_43_company_taxes,
      migration_2024_09_04T18_34_03_vat_report_date_override,
      migration_2024_09_05T15_51_41_depreciation,
    ],
  });
