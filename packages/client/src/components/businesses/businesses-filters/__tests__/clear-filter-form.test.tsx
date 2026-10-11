import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Form } from '../../../ui/form.js';
import { clearFilterForm } from '../clear-filter-form.js';
import { MultiSelectField } from '../multi-select-field.js';
import { NONE_OPTION_VALUE, type BusinessesFilterFormValues } from '../schema.js';
import { TriStateField } from '../tri-state-field.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let form: UseFormReturn<BusinessesFilterFormValues>;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Opens the form on an applied filter, as the dialog does when a filter is already set. */
function render(values: BusinessesFilterFormValues): void {
  function Harness(): ReactElement {
    form = useForm<BusinessesFilterFormValues>({ defaultValues: values });
    return (
      <Form {...form}>
        <MultiSelectField
          control={form.control}
          name="taxCategories"
          label="Tax category"
          options={[{ value: NONE_OPTION_VALUE, label: 'No tax category' }]}
        />
        <TriStateField control={form.control} name="isActive" label="Active" />
      </Form>
    );
  }
  act(() => root.render(<Harness />));
}

const pressed = (): string[] =>
  [...container.querySelectorAll('button[aria-pressed="true"]')].map(
    node => node.textContent ?? '',
  );

describe('clearFilterForm', () => {
  it('unsets every field, in the form state and on screen', () => {
    render({ taxCategories: [NONE_OPTION_VALUE], isActive: false });

    act(() => clearFilterForm(form));

    expect(form.getValues()).toEqual({});
    expect(pressed()).toEqual(['Any']);
  });

  /**
   * The regression `form.reset({})` had: the fields re-registered with the values the dialog
   * opened with, so the next edit — and Apply — brought the cleared filters back.
   */
  it('keeps them cleared through a later edit and submit', async () => {
    render({ taxCategories: [NONE_OPTION_VALUE], isActive: false });

    act(() => clearFilterForm(form));
    const yes = [...container.querySelectorAll('button')].find(node => node.textContent === 'Yes');
    act(() => {
      yes!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    let submitted: BusinessesFilterFormValues | undefined;
    await act(async () => {
      await form.handleSubmit(values => {
        submitted = values;
      })();
    });
    expect(submitted?.taxCategories).toBeUndefined();
    expect(submitted?.isActive).toBe(true);
  });
});
