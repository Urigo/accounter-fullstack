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
    ],
  });
