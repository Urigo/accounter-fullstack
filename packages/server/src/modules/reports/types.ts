import type { Shaam6111Data } from '../../__generated__/types.js';
import type { IGetLedgerRecordsByDatesResult } from '../ledger/types.js';

export type { DateOrString, currency } from './__generated__/balance-report.types.js';
export type * from './__generated__/types.js';
export type * from './__generated__/dynamic-report.types.js';
export type * from './__generated__/balance-report.types.js';
export type * from './__generated__/vat-report.types.js';
export type * from './__generated__/annual-revenue-report.types.js';

/** Accountant status of a single dynamic-report leaf. */
export type LeafApprovalStatus = 'APPROVED' | 'PENDING' | 'UNAPPROVED';

/** Stamp stored per leaf in `dynamic_report_snapshots.leaf_approvals`. */
export type LeafApproval = {
  status: LeafApprovalStatus;
  /** User id; null when system-stamped. */
  setBy: string | null;
  /** ISO timestamp, server clock. */
  setAt: string;
  system: boolean;
};

/**
 * `leaf_approvals` jsonb shape: counted report leaves only, keyed by entity id.
 * An absent entry means UNAPPROVED and never touched.
 */
export type LeafApprovals = Record<string, LeafApproval>;

export type CommentaryProto = {
  amount: number;
  records: CommentaryRecordProto[];
};

export type CommentaryRecordProto = {
  sortCode: number;
  amount: number;
  records: CommentarySubRecordProto[];
};

export type CommentarySubRecordProto = {
  financialEntityId: string;
  amount: number;
  ledgerRecords: IGetLedgerRecordsByDatesResult[];
};

export type ProfitAndLossReportYearProto = {
  year: number;
  revenue: CommentaryProto;
  costOfSales: CommentaryProto;
  grossProfit: number;

  researchAndDevelopmentExpenses: CommentaryProto;
  marketingExpenses: CommentaryProto;
  managementAndGeneralExpenses: CommentaryProto;
  operatingProfit: number;

  financialExpenses: CommentaryProto;
  otherIncome: CommentaryProto;

  profitBeforeTax: number;
  tax: number;
  netProfit: number;
};

export type TaxReportYearProto = {
  year: number;
  profitBeforeTax: CommentaryProto;
  researchAndDevelopmentExpensesByRecords: CommentaryProto;
  researchAndDevelopmentExpensesForTax: number;
  fines: CommentaryProto;
  untaxableGifts: CommentaryProto;
  businessTripsExcessExpensesAmount: number;
  salaryExcessExpensesAmount: number;
  reserves: CommentaryProto;
  nontaxableLinkage: CommentaryProto;

  taxableIncome: number;
  taxRate: number;
  specialTaxableIncome: CommentaryProto;
  specialTaxRate: number;
  annualTaxExpense: number;
};

export type Shaam6111ReportProto = {
  reportData: Shaam6111Data;
  businessId: string;
};
