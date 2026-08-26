// @vitest-environment happy-dom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Form } from '../../../ui/form.js';
import { ActiveFilterChips, type ChipLabelSources } from '../active-filter-chips.js';
import { buildEmptyFormValues } from '../constants.js';
import type { ChargeFilterFormValues } from '../schema.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function business(index: number) {
  return { value: `biz-${index}`, label: `Business ${index}` };
}

const SOURCES: ChipLabelSources = {
  owners: [],
  businesses: Array.from({ length: 30 }, (_, index) => business(index)),
  financialAccounts: [],
  tags: [],
  businessTrips: [],
  chargeTypes: [],
  accountantStatus: [],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function Harness({ values }: { values: Partial<ChargeFilterFormValues> }): ReactElement {
  const form = useForm<ChargeFilterFormValues>({
    defaultValues: { ...buildEmptyFormValues(), ...values },
  });
  return (
    <Form {...form}>
      <ActiveFilterChips sources={SOURCES} onClearAll={(): void => {}} />
    </Form>
  );
}

function renderWith(values: Partial<ChargeFilterFormValues>): void {
  act(() => root.render(<Harness values={values} />));
}

const chipCount = (): number => container.querySelectorAll('span.truncate').length;
const summaryText = (): string | undefined =>
  [...container.querySelectorAll('span')]
    .map(node => node.textContent ?? '')
    .find(text => text.endsWith('more filters') || text.endsWith('more filter'));

/**
 * The chips live in the dialog's `shrink-0` header, outside the scrollable body. An
 * unbounded list squeezes the form until it is unreachable, and "select all" on
 * financial entities makes that a couple of clicks away — so the count is capped.
 */
describe('ActiveFilterChips overflow', () => {
  it('renders nothing when no filter is active', () => {
    renderWith({});
    expect(container.textContent).toBe('');
  });

  it('renders every chip up to the cap, with no summary', () => {
    renderWith({ byBusinesses: Array.from({ length: 8 }, (_, index) => `biz-${index}`) });
    expect(chipCount()).toBe(8);
    expect(summaryText()).toBeUndefined();
  });

  // The boundary: one past the cap collapses the tail rather than showing a
  // "1 more filters" chip in place of the single chip it replaces.
  it('collapses to 7 chips plus a summary once over the cap', () => {
    renderWith({ byBusinesses: Array.from({ length: 9 }, (_, index) => `biz-${index}`) });
    expect(chipCount()).toBe(7);
    expect(summaryText()).toBe('2 more filters');
  });

  it('keeps the chip count fixed however many filters are active', () => {
    renderWith({ byBusinesses: Array.from({ length: 30 }, (_, index) => `biz-${index}`) });
    expect(chipCount()).toBe(7);
    expect(summaryText()).toBe('23 more filters');
  });

  // Chips come from every filter family, not just one multi-select.
  it('counts chips across mixed filter families', () => {
    renderWith({
      byBusinesses: Array.from({ length: 7 }, (_, index) => `biz-${index}`),
      freeText: 'coffee',
      fromAnyDate: '2026-01-01',
    });
    expect(chipCount()).toBe(7);
    expect(summaryText()).toBe('2 more filters');
  });

  // 2 is the floor: the cap shows all 8, so overflow starts at 9 chips -> 7 + 2.
  it('never reports a single hidden filter', () => {
    renderWith({ byBusinesses: Array.from({ length: 9 }, (_, index) => `biz-${index}`) });
    expect(summaryText()).not.toBe('1 more filters');
    expect(summaryText()).toBe('2 more filters');
  });
});
