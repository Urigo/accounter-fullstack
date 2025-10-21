import { BillingCycle, SubscriptionPlan } from '@/gql/graphql.js';

export function standardBillingCycle(billingCycle: BillingCycle): string {
  switch (billingCycle) {
    case BillingCycle.Annual:
      return 'Annual';
    case BillingCycle.Monthly:
      return 'Monthly';
    default:
      throw new Error(`Unsupported Billing Cycle: ${billingCycle}`);
  }
}
export function standardPlan(plan: SubscriptionPlan): string {
  switch (plan) {
    case SubscriptionPlan.Enterprise:
      return 'Enterprise';
    case SubscriptionPlan.Pro:
      return 'Pro';
    default:
      throw new Error(`Unsupported Subscription plan: ${plan}`);
  }
}
