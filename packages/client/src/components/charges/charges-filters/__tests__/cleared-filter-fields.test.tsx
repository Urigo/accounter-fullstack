// @vitest-environment happy-dom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Form } from '../../../ui/form.js';
import { buildEmptyFormValues } from '../constants.js';
import { FreeTextField } from '../free-text-field.js';
import { NegatableMultiSelectField } from '../negatable-multi-select-field.js';
import type { ChargeFilterFormValues } from '../schema.js';
import { CompletenessSection } from '../sections/completeness-section.js';
import { DateRangeSection } from '../sections/date-range-section.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OPTIONS = [
  { value: 'biz-1', label: 'Business 1' },
  { value: 'biz-2', label: 'Business 2' },
];

let container: HTMLDivElement;
let root: Root;
let form: UseFormReturn<ChargeFilterFormValues>;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/**
 * The bug only exists relative to a value the field already had: react-hook-form's
 * controller falls back to whatever the field held when it mounted. So every case here
 * opens the form on an applied filter, exactly as the modal does on a second visit.
 */
function renderWith(
  values: Partial<ChargeFilterFormValues>,
  body: (control: UseFormReturn<ChargeFilterFormValues>['control']) => ReactElement,
): void {
  function Harness(): ReactElement {
    form = useForm<ChargeFilterFormValues>({
      defaultValues: { ...buildEmptyFormValues(), ...values },
    });
    return <Form {...form}>{body(form.control)}</Form>;
  }
  act(() => root.render(<Harness />));
}

function renderEntities(values: Partial<ChargeFilterFormValues>): void {
  renderWith(values, control => (
    <NegatableMultiSelectField
      control={control}
      include="byBusinesses"
      exclude="excludedBusinesses"
      label="Financial Entities"
      options={OPTIONS}
      placeholder="All counterparties"
    />
  ));
}

const chipLabels = (): string[] =>
  [...container.querySelectorAll('span.truncate')].map(node => node.textContent ?? '');

function click(selector: string): void {
  const target = container.querySelector(selector);
  expect(target, `no element matching ${selector}`).not.toBeNull();
  act(() => {
    target!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('clearing a filter that was applied when the form opened', () => {
  it('empties the entities picker and the form state together', () => {
    renderEntities({ byBusinesses: ['biz-1'] });
    expect(chipLabels()).toEqual(['Business 1']);

    click('button[aria-label="Remove Business 1"]');

    // The regression: the picker used to re-render "Business 1" from the controller's
    // mount-time fallback while the form state held nothing, so Apply sent an unfiltered
    // query. Display and form state have to agree.
    expect(chipLabels()).toEqual([]);
    expect(container.textContent).toContain('All counterparties');
    expect(form.getValues('byBusinesses')).toBeUndefined();
  });

  it('empties the exclude leg the same way', () => {
    renderEntities({ excludedBusinesses: ['biz-2'] });
    expect(chipLabels()).toEqual(['Business 2']);

    click('button[aria-label="Remove Business 2"]');

    expect(chipLabels()).toEqual([]);
    expect(form.getValues('excludedBusinesses')).toBeUndefined();
  });

  it('keeps the values it did not clear', () => {
    renderEntities({ byBusinesses: ['biz-1', 'biz-2'] });

    click('button[aria-label="Remove Business 1"]');

    expect(chipLabels()).toEqual(['Business 2']);
    expect(form.getValues('byBusinesses')).toEqual(['biz-2']);
  });

  // "Clear all" and "Reset" both go through form.reset(), which writes the same
  // `undefined` the controller falls back over.
  it('empties the picker when the form is reset', () => {
    renderEntities({ byBusinesses: ['biz-1'], excludedBusinesses: ['biz-2'] });
    expect(chipLabels()).toEqual(['Business 1', 'Business 2']);

    act(() => form.reset(buildEmptyFormValues()));

    expect(chipLabels()).toEqual([]);
    expect(container.textContent).toContain('All counterparties');
  });

  // Same fallback, non-array fields: these clear from the header chips, which call
  // setValue(name, undefined).
  it('empties the free text input', () => {
    renderWith({ freeText: 'coffee' }, control => <FreeTextField control={control} />);
    expect(container.querySelector<HTMLInputElement>('#charges-free-text')?.value).toBe('coffee');

    act(() => form.setValue('freeText', undefined, { shouldDirty: true }));

    expect(container.querySelector<HTMLInputElement>('#charges-free-text')?.value).toBe('');
  });

  it('empties a date input', () => {
    renderWith({ fromAnyDate: '2026-01-01' }, control => <DateRangeSection control={control} />);
    expect(container.querySelector<HTMLInputElement>('#from-any-date')?.value).toBe('2026-01-01');

    act(() => form.setValue('fromAnyDate', undefined, { shouldDirty: true }));

    expect(container.querySelector<HTMLInputElement>('#from-any-date')?.value).toBe('');
  });

  it('switches a completeness toggle back off', () => {
    renderWith({ withoutInvoice: true }, control => <CompletenessSection control={control} />);
    const toggle = (): Element | null => container.querySelector('[role="switch"]');
    expect(toggle()?.getAttribute('aria-checked')).toBe('true');

    act(() => form.setValue('withoutInvoice', undefined, { shouldDirty: true }));

    expect(toggle()?.getAttribute('aria-checked')).toBe('false');
  });
});
