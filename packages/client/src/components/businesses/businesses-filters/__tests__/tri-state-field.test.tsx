import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Form } from '../../../ui/form.js';
import type { BusinessesFilterFormValues } from '../schema.js';
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

function render(values: BusinessesFilterFormValues): void {
  function Harness(): ReactElement {
    form = useForm<BusinessesFilterFormValues>({ defaultValues: values });
    return (
      <Form {...form}>
        <TriStateField control={form.control} name="isClient" label="Client" />
      </Form>
    );
  }
  act(() => root.render(<Harness />));
}

function button(label: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find(
    node => node.textContent === label,
  );
  expect(match, `no "${label}" button`).toBeDefined();
  return match!;
}

function click(label: string): void {
  act(() => {
    button(label).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

const pressed = (): string[] =>
  [...container.querySelectorAll('button[aria-pressed="true"]')].map(
    node => node.textContent ?? '',
  );

describe('TriStateField', () => {
  it('shows "Any" when unset', () => {
    render({});
    expect(pressed()).toEqual(['Any']);
  });

  it('writes true for Yes and false for No', () => {
    render({});

    click('Yes');
    expect(form.getValues('isClient')).toBe(true);
    expect(pressed()).toEqual(['Yes']);

    click('No');
    expect(form.getValues('isClient')).toBe(false);
    expect(pressed()).toEqual(['No']);
  });

  /**
   * react-hook-form's controller falls back to the value a field mounted with when the stored
   * value is undefined, so "Any" on a form opened with a set value is where a naive render goes
   * wrong.
   */
  it('goes back to "Any" (undefined) on a form opened with a set value', () => {
    render({ isClient: false });
    expect(pressed()).toEqual(['No']);

    click('Any');
    expect(form.getValues('isClient')).toBeUndefined();
    expect(pressed()).toEqual(['Any']);
  });
});
