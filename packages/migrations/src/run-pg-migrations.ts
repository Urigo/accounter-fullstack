import { type DatabasePool } from 'slonik';
import migration_2024_01_29T13_15_23_initial from './actions/2024-01-29T13-15-23.initial.js';
import { runMigrations } from './pg-migrator.js';

export const runPGMigrations = (args: { slonik: DatabasePool; runTo?: string }) =>
  runMigrations({
    slonik: args.slonik,
    runTo: args.runTo,
    migrations: [migration_2024_01_29T13_15_23_initial],
  });
