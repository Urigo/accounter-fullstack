import { BillingCycle, Product, SubscriptionPlan } from '@shared/gql-types';

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
