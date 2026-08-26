// @vitest-environment happy-dom

import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NegatableMultiSelect } from '../negatable-multi-select.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
  { value: 'c', label: 'Charlie' },
];

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

function render(ui: Parameters<Root['render']>[0]): void {
  act(() => root.render(ui));
}

describe('NegatableMultiSelect', () => {
  /**
   * React 19 passes `ref` to function components as an ordinary prop, so this
   * component takes it in props instead of being wrapped in `forwardRef` (which is
   * deprecated). RHF's `field.ref` relies on that reaching the DOM node, so pin it.
   */
  it('forwards a ref to the trigger without forwardRef', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <NegatableMultiSelect ref={ref} options={OPTIONS} value={[]} onValueChange={(): void => {}} />,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.getAttribute('role')).toBe('combobox');
    // focusable despite not being a button
    expect(ref.current?.getAttribute('tabindex')).toBe('0');
  });

  it('does not nest interactive elements inside the trigger', () => {
    // Chips carry their own flip/remove buttons, so the trigger cannot be a <button>.
    render(
      <NegatableMultiSelect
        negatable
        options={OPTIONS}
        value={['a']}
        excludedValue={['b']}
        onValueChange={(): void => {}}
        onExcludedChange={(): void => {}}
      />,
    );
    const trigger = container.querySelector('[role="combobox"]');
    expect(trigger?.tagName).toBe('DIV');
    expect(trigger?.closest('button')).toBeNull();
    // the chip buttons are still there, just no longer inside a button
    expect(trigger?.querySelectorAll('button').length).toBeGreaterThan(0);
  });

  it('applies the id and aria wiring FormControl injects', () => {
    render(
      <NegatableMultiSelect
        id="my-field"
        aria-describedby="my-desc"
        aria-invalid
        options={OPTIONS}
        value={[]}
        onValueChange={(): void => {}}
      />,
    );
    const trigger = container.querySelector('[role="combobox"]');
    expect(trigger?.id).toBe('my-field');
    expect(trigger?.getAttribute('aria-describedby')).toBe('my-desc');
    // aria-invalid is invalid on role=button, which is why the trigger is a combobox
    expect(trigger?.getAttribute('aria-invalid')).toBe('true');
    expect(trigger?.getAttribute('aria-controls')).toBeTruthy();
  });

  it('renders one chip per value when a payload lists it as both included and excluded', () => {
    // Unreachable through the tri-state, but a hand-edited ?chargesFilters= can do it,
    // and duplicates would collide on the React key.
    render(
      <NegatableMultiSelect
        negatable
        options={OPTIONS}
        value={['a']}
        excludedValue={['a']}
        onValueChange={(): void => {}}
        onExcludedChange={(): void => {}}
      />,
    );
    const chipLabels = [...container.querySelectorAll('span.truncate')].map(
      node => node.textContent,
    );
    expect(chipLabels).toEqual(['Alpha']);
  });

  it('shows a loading state and disables the trigger while options load', () => {
    render(
      <NegatableMultiSelect
        loading
        options={[]}
        value={[]}
        onValueChange={(): void => {}}
        placeholder="All counterparties"
      />,
    );
    const trigger = container.querySelector('[role="combobox"]');
    expect(trigger?.getAttribute('aria-disabled')).toBe('true');
    expect(trigger?.getAttribute('tabindex')).toBe('-1');
    expect(container.textContent).toContain('Loading');
  });

  it('renders the placeholder when nothing is selected', () => {
    render(
      <NegatableMultiSelect
        options={OPTIONS}
        value={[]}
        onValueChange={(): void => {}}
        placeholder="All counterparties"
      />,
    );
    expect(container.textContent).toContain('All counterparties');
  });
});
