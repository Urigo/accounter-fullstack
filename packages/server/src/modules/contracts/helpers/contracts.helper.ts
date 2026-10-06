import { format } from 'date-fns';
import type { BillingCycle, Product, SubscriptionPlan } from '../../../__generated__/types.js';
import {
  addMonthsToTimelessDate,
  getTimelessDateYear,
  timelessDateStringToLocalDate,
  todayTimelessDate,
} from '../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import type { IGetContractsByIdsResult } from '../types.js';

export function normalizeSubscriptionPlan(raw?: string | null): SubscriptionPlan | null {
  if (!raw) {
    return null;
  }
  switch (raw.toLocaleLowerCase()) {
    case 'enterprise':
      return 'ENTERPRISE';
    case 'pro':
      return 'PRO';
    default:
      throw new Error(`Unknown subscription plan: ${raw}`);
  }
}

export function getSubscriptionPlanName(plan: SubscriptionPlan): string {
  switch (plan) {
    case 'ENTERPRISE':
      return 'Enterprise License';
    case 'PRO':
      return 'Pro Plan';
    default:
      throw new Error(`Unknown subscription plan: ${plan}`);
  }
}

export function normalizeProduct(raw?: string | null): Product | null {
  if (!raw) {
    return null;
  }
  switch (raw.toLocaleLowerCase()) {
    case 'hive':
      return 'HIVE';
    case 'stellate':
      return 'STELLATE';
    default:
      throw new Error(`Unknown product: ${raw}`);
  }
}

export function getProductName(product: Product): string {
  switch (product) {
    case 'HIVE':
      return 'GraphQL Hive';
    case 'STELLATE':
      return 'Stellate';
    default:
      throw new Error(`Unknown product: ${product}`);
  }
}

export function normalizeBillingCycle(raw: string): BillingCycle {
  switch (raw.toLocaleLowerCase()) {
    case 'monthly':
      return 'MONTHLY';
    case 'annual':
      return 'ANNUAL';
    default:
      throw new Error(`Unknown billing cycle: ${raw}`);
  }
}

/**
 * Builds the document description for a contract-generated document.
 *
 * - Monthly contracts keep the billed month description (e.g. "… - May 2026").
 * - Annual contracts use the contract's start & end dates (e.g.
 *   "… January 15th, 2025 → January 14th, 2026").
 */
export function buildContractDocumentDescription(
  contract: IGetContractsByIdsResult,
  issueMonth: TimelessDateString,
): string {
  const productPlanName = `${getProductName(normalizeProduct(contract.product ?? '')!)} ${getSubscriptionPlanName(normalizeSubscriptionPlan(contract.plan ?? '')!)}`;

  if (normalizeBillingCycle(contract.billing_cycle) === 'ANNUAL') {
    const start = format(timelessDateStringToLocalDate(contract.start_date), 'MMMM do, yyyy');
    const end = format(timelessDateStringToLocalDate(contract.end_date), 'MMMM do, yyyy');
    return `${productPlanName} ${start} → ${end}`;
  }

  // When no issue month is given, bill the tenant's previous month.
  const billedMonth = issueMonth ?? addMonthsToTimelessDate(todayTimelessDate(), -1);
  const year = getTimelessDateYear(billedMonth);
  // local midnight of the day, read back with local-time `format`: the same calendar day
  const month = format(timelessDateStringToLocalDate(billedMonth), 'MMMM');
  return `${productPlanName} - ${month} ${year}`;
}
