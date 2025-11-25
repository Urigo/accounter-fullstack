/**
 * TypeScript interfaces for ledger validation
 *
 * These types match the database schema from accounter_schema.ledger_records
 * and provide context for comprehensive validation of demo data.
 */

/**
 * Ledger record interface matching the database schema
 *
 * Numeric fields are typed as `string | null` because PostgreSQL returns
 * numeric values as strings when queried via pg driver.
 */
export interface LedgerRecord {
  id: string;
  owner_id: string | null;
  charge_id: string;

  debit_entity1: string | null;
  debit_foreign_amount1: string | null;
  debit_local_amount1: string | null;

  credit_entity1: string | null;
  credit_foreign_amount1: string | null;
  credit_local_amount1: string | null;

  debit_entity2: string | null;
  debit_foreign_amount2: string | null;
  debit_local_amount2: string | null;

  credit_entity2: string | null;
  credit_foreign_amount2: string | null;
  credit_local_amount2: string | null;

  currency: string;
  invoice_date: Date;
  value_date: Date;
  description: string | null;
  reference1: string | null;
  locked: boolean;
}

/**
 * Validation context containing configuration for validation rules
 *
 * Used to pass contextual information to validator functions such as
 * which use-case is being validated and what tolerance to use for
 * balance comparisons.
 */
export interface ValidationContext {
  /** Unique identifier of the use-case being validated */
  useCaseId: string;

  /** Default local currency (e.g., 'ILS') for foreign currency validation */
  defaultCurrency: string;

  /** Tolerance for floating-point balance comparisons (e.g., 0.01) */
  tolerance: number;
}

/**
 * Entity balance tracking for multi-record entity-level validation
 *
 * Aggregates debit and credit amounts across all ledger records
 * for a specific financial entity to verify the entity's net
 * position balances correctly.
 */
export interface EntityBalance {
  /** Financial entity UUID */
  entityId: string;

  /** Total debit amount in local currency */
  totalDebit: number;

  /** Total credit amount in local currency */
  totalCredit: number;

  /** Net balance (totalDebit - totalCredit), should be ~0 */
  netBalance: number;

  /** Number of ledger records involving this entity */
  recordCount: number;
}
