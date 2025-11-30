import type {
  BusinessFixture,
  ChargeFixture,
  DocumentFixture,
  FinancialAccountFixture,
  TagFixture,
  TaxCategoryFixture,
  TransactionFixture,
  UseCaseExpectations,
} from '../demo-fixtures/types.js';
import type { LedgerRecord } from '../demo-fixtures/validators/types.js';

export interface FixtureSpec {
  meta?: {
    id: string;
    description?: string;
    version?: string;
    [key: string]: unknown;
  };
  businesses: BusinessFixture[];
  taxCategories: TaxCategoryFixture[];
  financialAccounts: FinancialAccountFixture[];
  charges: ChargeFixture[];
  transactions: TransactionFixture[];
  documents: DocumentFixture[];
  tags?: TagFixture[];
  expectations?: UseCaseExpectations & { ledger?: LedgerRecord[] };
  placeholders?: Record<string, string>;
}
