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
import migration_2024_10_01T12_37_42_refactor_misc_expenses from './actions/2024-10-01T12-37-42.refactor-misc-expenses.js';
import migration_2024_10_10T15_56_41_recovery_reserve from './actions/2024-10-10T15-56-41.recovery-reserve.js';
import migration_2024_11_03T14_42_42_green_invoice_business_match from './actions/2024-11-03T14-42-42.green-invoice-business-match.js';
import migration_2024_11_11T09_54_23_financial_accounts_enum_type from './actions/2024-11-11T09-54-23.financial-accounts-enum-type.js';
import migration_2024_11_14T17_52_14_add_job_percentage_to_salaries from './actions/2024-11-14T17-52-14.add-job-percentage-to-salaries.js';
import migration_2024_11_145T12_15_43_origin_scraper_tables_adjustments from './actions/2024-11-145T12-15-43.origin-scraper-tables-adjustments.js';
import migration_2024_12_10T10_07_15_business_trips_cleanups from './actions/2024-12-10T10-07-15.business-trips-cleanups.js';
import migration_2024_12_12T12_15_43_visa_cal from './actions/2024-12-12T12-15-43.visa-cal.js';
import migration_2024_12_12T12_48_58_add_countries_table from './actions/2024-12-12T12-48-58.add-countries-table.js';
import migration_2024_12_12T19_03_37_enhance_business_trips_flights_path from './actions/2024-12-12T19-03-37.enhance-business-trips-flights-path.js';
import migration_2024_12_15T13_09_27_enhance_business_trips_transactions_view from './actions/2024-12-15T13-09-27.enhance-business-trips-transactions-view.js';
import migration_2024_12_16T09_31_25_amex_scraper_completion from './actions/2024-12-16T09-31-25.amex-scraper-completion.js';
import migration_2024_12_20T08_23_25_use_businesses_for_foreign_keys from './actions/2024-12-20T08-23-25.use-businesses-for-foreign-keys.js';
import migration_2024_12_26T12_15_43_bank_discount from './actions/2024-12-26T12-15-43.bank-discount.js';
import migration_2025_01_05T18_20_42_vat_table from './actions/2025-01-05T18-20-42.vat-table.js';
import migration_2025_01_07T18_54_54_poalim_foreign_event_details_column_update from './actions/2025-01-07T18-54-54.poalim-foreign-event-details-column-update.js';
import migration_2025_01_12T11_47_46_support_cad_currency from './actions/2025-01-12T11-47-46.support-cad-currency.js';
import migration_2025_01_14T18_59_26_add_user_context_table from './actions/2025-01-14T18-59-26.add-user-context-table.js';
import migration_2025_01_21T13_37_41_add_poalim_cad from './actions/2025-01-21T13-37-41.add-poalim-cad.js';
import migration_2025_01_21T21_50_26_add_max_creditcard_source from './actions/2025-01-21T21-50-26.add-max-creditcard-source.js';
import migration_2025_01_29T17_31_52_add_counter_account_to_extended_transaction from './actions/2025-01-29T17-31-52.add-counter-account-to-extended-transaction.js';
import migration_2025_01_30T11_50_54_max_transactions_trigger_fix from './actions/2025-01-30T11-50-54.max-transactions-trigger-fix.js';
import migration_2025_02_14T11_50_44_dynamic_report_templates_table from './actions/2025-02-12T11-50-44.dynamic-report-templates-table.js';
import migration_2025_02_13T14_40_22_update_poalim_column_length_restriction from './actions/2025-02-13T14-40-22.update-poalim-column-length-restriction.js';
import migration_2025_02_19T15_12_33_add_to_context_salary_excess_expenses from './actions/2025-02-19T15-12-33.add-to-context-salary-excess-expenses.js';
import migration_2025_02_26T19_27_56_add_to_context_ledger_lock from './actions/2025-02-26T19-27-56.add-to-context-ledger-lock.js';
import migration_2025_03_04T16_29_18_update_charges_view_add_no_doc_req_flag from './actions/2025-03-04T16-29-18.update-charges-view-add-no-doc-req-flag.js';
import migration_2025_03_10T16_21_31_charge_no_docs_flag from './actions/2025-03-10T16-21-31.charge-no-docs-flag.js';
import migration_2025_03_13T13_24_43_deel_data from './actions/2025-03-13T13-24-43.deel-data.js';
import migration_2025_03_19T12_05_43_deel_api_tables from './actions/2025-03-19T12-05-43.deel-api-tables.js';
import migration_2025_03_24T18_35_56_add_to_context_ledger_lock2 from './actions/2025-03-24T18-35-56.add-to-context-ledger-lock2.js';
import migration_2025_03_27T11_33_29_documents_allocation_numbers from './actions/2025-03-27T11-33-29.documents-allocation-numbers.js';
import migration_2025_03_30T18_56_00_add_salary_tns_property from './actions/2025-03-30T18-56-00.add-salary-tns-property.js';
import migration_2025_04_08T09_16_45_static_extend_transactions from './actions/2025-04-08T09-16-45.static-extend-transactions.js';
import migration_2025_04_08T14_28_54_drop_extended_transactions_view from './actions/2025-04-08T14-28-54.drop-extended-transactions-view.js';
import migration_2025_04_09T14_39_52_drop_extended_transactions_additions from './actions/2025-04-09T14-39-52.drop-extended-transactions-additions.js';
import migration_2025_04_10T15_44_07_tax_excluded_flag from './actions/2025-04-10T15-44-07.tax-excluded-flag.js';
import migration_2025_04_15T17_27_28_pcn874 from './actions/2025-04-15T17-27-28.pcn874.js';
import migration_2025_05_13T12_28_00_corporate_special_tax_rate from './actions/2025-05-13T12-28-00.corporate-special-tax-rate.js';
import migration_2025_05_18T13_02_20_override_documents_exchange_rate from './actions/2025-05-18T13-02-20.override-documents-exchange-rate.js';
import migration_2025_05_19T15_45_46_override_pcn874_record_type from './actions/2025-05-19T15-45-46.override-pcn874-record-type.js';
import migration_2025_05_22T12_13_40_shaam_6111_adjustments from './actions/2025-05-22T12-13-40.shaam-6111-adjustments.js';
import migration_2025_05_26T12_23_36_convert_irs_code_column_to_array from './actions/2025-05-26T12-23-36.convert-irs-code-column-to-array.js';
import migration_2025_05_26T12_23_36_convert_irs_code_column_to_array2 from './actions/2025-05-26T12-23-36.convert-irs-code-column-to-array2.js';
import migration_2025_06_08T12_23_53_poalim_foreign_less_strict from './actions/2025-06-08T12-23-53.poalim-foreign-less-strict.js';
import migration_2025_06_09T18_11_34_convert_irs_codes_array_column_to_single from './actions/2025-06-09T18-11-34.convert-irs-codes-array-column-to-single.js';
import migration_2025_06_10T10_45_37_convert_irs_codes_array_column_to_single2 from './actions/2025-06-10T10-45-37.convert-irs-codes-array-column-to-single2.js';
import migration_2025_06_26T20_52_26_migrate_from_multiple_tables_to_single_poalim_foreign_table from './actions/2025-06-26T20-52-26.migrate-from-multiple-tables-to-single-poalim-foreign-table.js';
import migration_2025_06_28T13_12_45_fix_poalim_swift_trigger_function from './actions/2025-06-28T13-12-45.fix-poalim-swift-trigger-function.js';
import migration_2025_06_29T12_27_18_support_jpy_currency from './actions/2025-06-29T12-27-18.support-jpy-currency.js';
import migration_2025_06_29T15_28_00_currency_fix from './actions/2025-06-29T15-28-00.currency-fix.js';
import migration_2025_06_30T16_20_19_deel_data_update from './actions/2025-06-30T16-20-19.deel-data-update.js';
import migration_2025_07_03T10_47_48_move_admin_businesses_info_to_designated_table from './actions/2025-07-03T10-47-48.move-admin-businesses-info-to-designated-table.js';
import migration_2025_07_07T10_30_32_support_aud_currency from './actions/2025-07-07T10-30-32.support-aud-currency.js';
import migration_2025_07_10T14_13_43_swift_table_extension from './actions/2025-07-10T14-13-43.swift-table-extension.js';
import migration_2025_07_14T14_35_02_swift_multiple_currencies_handle from './actions/2025-07-14T14-35-02.swift-multiple-currencies-handle.js';
import migration_2025_07_23T11_00_24_support_sek_currency from './actions/2025-07-23T11-00-24.support-sek-currency.js';
import migration_2025_07_24T11_27_13_enhance_charges_doc_dates_calc from './actions/2025-07-24T11-27-13.enhance-charges-doc-dates-calc.js';
import migration_2025_07_25T11_55_52_self_issued_documents_table from './actions/2025-07-25T11-55-52.self-issued-documents-table.js';
import migration_2025_07_30T19_01_04_jpy_rate_fix from './actions/2025-07-30T19-01-04.jpy-rate-fix.js';
import migration_2025_08_03T15_08_25_add_charge_open_docs_flag from './actions/2025-08-03T15-08-25.add-charge-open-docs-flag.js';
import migration_2025_08_11T11_45_42_clients_contracts_table from './actions/2025-08-11T11-45-42.clients-contracts-table.js';
import migration_2025_08_12T18_50_12_extend_isracard_table from './actions/2025-08-12T18-50-12.extend-isracard-table.js';
import migration_2025_08_13T20_05_23_foreign_securities_support from './actions/2025-08-13T20-05-23.foreign-securities-support.js';
import migration_2025_09_16T10_16_35_enhance_poalim_fees_recognition from './actions/2025-09-16T10-16-35.enhance-poalim-fees-recognition.js';
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
      migration_2024_10_01T12_37_42_refactor_misc_expenses,
      migration_2024_10_10T15_56_41_recovery_reserve,
      migration_2024_11_03T14_42_42_green_invoice_business_match,
      migration_2024_11_11T09_54_23_financial_accounts_enum_type,
      migration_2024_11_14T17_52_14_add_job_percentage_to_salaries,
      migration_2024_11_145T12_15_43_origin_scraper_tables_adjustments,
      migration_2024_12_10T10_07_15_business_trips_cleanups,
      migration_2024_12_12T12_15_43_visa_cal,
      migration_2024_12_12T12_48_58_add_countries_table,
      migration_2024_12_12T19_03_37_enhance_business_trips_flights_path,
      migration_2024_12_15T13_09_27_enhance_business_trips_transactions_view,
      migration_2024_12_16T09_31_25_amex_scraper_completion,
      migration_2024_12_20T08_23_25_use_businesses_for_foreign_keys,
      migration_2024_12_26T12_15_43_bank_discount,
      migration_2025_01_05T18_20_42_vat_table,
      migration_2025_01_07T18_54_54_poalim_foreign_event_details_column_update,
      migration_2025_01_12T11_47_46_support_cad_currency,
      migration_2025_01_14T18_59_26_add_user_context_table,
      migration_2025_01_21T13_37_41_add_poalim_cad,
      migration_2025_01_21T21_50_26_add_max_creditcard_source,
      migration_2025_01_29T17_31_52_add_counter_account_to_extended_transaction,
      migration_2025_01_30T11_50_54_max_transactions_trigger_fix,
      migration_2025_02_13T14_40_22_update_poalim_column_length_restriction,
      migration_2025_02_14T11_50_44_dynamic_report_templates_table,
      migration_2025_02_19T15_12_33_add_to_context_salary_excess_expenses,
      migration_2025_02_26T19_27_56_add_to_context_ledger_lock,
      migration_2025_03_04T16_29_18_update_charges_view_add_no_doc_req_flag,
      migration_2025_03_10T16_21_31_charge_no_docs_flag,
      migration_2025_03_13T13_24_43_deel_data,
      migration_2025_03_19T12_05_43_deel_api_tables,
      migration_2025_03_24T18_35_56_add_to_context_ledger_lock2,
      migration_2025_03_27T11_33_29_documents_allocation_numbers,
      migration_2025_03_30T18_56_00_add_salary_tns_property,
      migration_2025_04_08T09_16_45_static_extend_transactions,
      migration_2025_04_08T14_28_54_drop_extended_transactions_view,
      migration_2025_04_09T14_39_52_drop_extended_transactions_additions,
      migration_2025_04_10T15_44_07_tax_excluded_flag,
      migration_2025_04_15T17_27_28_pcn874,
      migration_2025_05_13T12_28_00_corporate_special_tax_rate,
      migration_2025_05_18T13_02_20_override_documents_exchange_rate,
      migration_2025_05_19T15_45_46_override_pcn874_record_type,
      migration_2025_05_22T12_13_40_shaam_6111_adjustments,
      migration_2025_05_26T12_23_36_convert_irs_code_column_to_array,
      migration_2025_05_26T12_23_36_convert_irs_code_column_to_array2,
      migration_2025_06_08T12_23_53_poalim_foreign_less_strict,
      migration_2025_06_09T18_11_34_convert_irs_codes_array_column_to_single,
      migration_2025_06_10T10_45_37_convert_irs_codes_array_column_to_single2,
      migration_2025_06_26T20_52_26_migrate_from_multiple_tables_to_single_poalim_foreign_table,
      migration_2025_06_28T13_12_45_fix_poalim_swift_trigger_function,
      migration_2025_06_29T12_27_18_support_jpy_currency,
      migration_2025_06_29T15_28_00_currency_fix,
      migration_2025_06_30T16_20_19_deel_data_update,
      migration_2025_07_07T10_30_32_support_aud_currency,
      migration_2025_07_10T14_13_43_swift_table_extension,
      migration_2025_07_14T14_35_02_swift_multiple_currencies_handle,
      migration_2025_07_03T10_47_48_move_admin_businesses_info_to_designated_table,
      migration_2025_07_23T11_00_24_support_sek_currency,
      migration_2025_07_24T11_27_13_enhance_charges_doc_dates_calc,
      migration_2025_07_30T19_01_04_jpy_rate_fix,
      migration_2025_07_25T11_55_52_self_issued_documents_table,
      migration_2025_08_03T15_08_25_add_charge_open_docs_flag,
      migration_2025_08_11T11_45_42_clients_contracts_table,
      migration_2025_08_12T18_50_12_extend_isracard_table,
      migration_2025_08_13T20_05_23_foreign_securities_support,
      migration_2025_09_16T10_16_35_enhance_poalim_fees_recognition,
    ],
  });
