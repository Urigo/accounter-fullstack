import { type DatabasePool } from 'slonik';
import migration_2024_01_29T13_15_23_initial from './actions/2024-01-29T13-15-23.initial.js';
import migration_2024_02_22T21_37_11_charge_year_of_relevance from './actions/2024-02-22T21-37-11.charge-year-of-relevance.js';
import migration_2024_02_26T11_01_45_centralize_financial_entities_shared_columns from './actions/2024-02-26T11-01-45.centralize-financial-entities-shared-columns.js';
import migration_2024_03_17T23_10_10_filter_distinct_transactions_currencies_on_charge from './actions/2024-03-17T23-10-10.filter-distinct-transactions-currencies-on-charge.js';
import { runMigrations } from './pg-migrator.js';

export const runPGMigrations = (args: { slonik: DatabasePool; runTo?: string }) =>
  runMigrations({
    slonik: args.slonik,
    runTo: args.runTo,
    migrations: [
      migration_2024_01_29T13_15_23_initial,
      migration_2024_02_22T21_37_11_charge_year_of_relevance,
      migration_2024_02_26T11_01_45_centralize_financial_entities_shared_columns,
      migration_2024_03_17T23_10_10_filter_distinct_transactions_currencies_on_charge,
    ],
  });
