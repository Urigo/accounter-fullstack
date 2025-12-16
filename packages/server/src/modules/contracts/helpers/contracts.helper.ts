import type { BillingCycle, Product, SubscriptionPlan } from '../../../__generated__/types.js';

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
