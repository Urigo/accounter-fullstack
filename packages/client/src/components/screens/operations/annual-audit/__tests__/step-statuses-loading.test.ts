import { describe, expect, it } from 'vitest';
import { isLoadingStepStatuses } from '../step-statuses-loading.js';

const base = { adminBusinessId: 'owner-1', fetching: true, hasData: true, year: 2025 };

describe('isLoadingStepStatuses', () => {
  it('shows the loading card on the first load', () => {
    expect(isLoadingStepStatuses({ ...base, hasData: false, loadedYear: undefined })).toBe(true);
  });

  it('keeps the steps mounted while the same year is refetched', () => {
    expect(isLoadingStepStatuses({ ...base, loadedYear: 2025 })).toBe(false);
  });

  it("doesn't show the previous year's statuses while a new year loads", () => {
    expect(isLoadingStepStatuses({ ...base, loadedYear: 2024 })).toBe(true);
  });

  it('is not loading once the query settles, or without a business', () => {
    expect(isLoadingStepStatuses({ ...base, fetching: false, loadedYear: 2024 })).toBe(false);
    expect(isLoadingStepStatuses({ ...base, adminBusinessId: undefined, loadedYear: 2024 })).toBe(
      false,
    );
  });
});
