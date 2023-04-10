import type { IGetChargesByFiltersResult } from '@modules/charges/types.js';

export function filterOutExcludedBusinesses(charges: IGetChargesByFiltersResult[]) {
  // TODO(Gil): implement this in a better way, maybe DB flag
  const EXCLUDED_BUSINESS_NAMES = [
    '6d4b01dd-5a5e-4a43-8e40-e9dadfcc10fa', // Social Security Deductions
    '9d3a8a88-6958-4119-b509-d50a7cdc0744', // Tax
    'c7fdf6f6-e075-44ee-b251-cbefea366826', // Vat
    '3176e27a-3f54-43ec-9f5a-9c1d4d7876da', // Dotan Simha Dividend
  ];

  return charges.filter(charge => {
    for (const businessId of charge.business_array ?? []) {
      if (EXCLUDED_BUSINESS_NAMES.includes(businessId)) {
        return false;
      }
    }
    return true;
  });
}
