// @vitest-environment happy-dom

import { act, createRef, useState, type ReactElement } from 'react';
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

  /**
   * The filter dialogs migrated off Mantine's `MultiSelect` use the default,
   * non-negatable mode and pass no `onExcludedChange`. Removing a chip must therefore
   * not depend on that callback being there, and no include/exclude toggle should show.
   */
  it('removes a chip in non-negatable mode without an onExcludedChange handler', () => {
    const changes: string[][] = [];
    render(
      <NegatableMultiSelect
        options={OPTIONS}
        value={['a', 'b']}
        onValueChange={(next): void => {
          changes.push(next);
        }}
      />,
    );
    const trigger = container.querySelector('[role="combobox"]');
    expect(trigger?.querySelector('[aria-label="Switch to exclude"]')).toBeNull();

    // A listener that throws does not propagate out of `click()` — the DOM reports it as
    // an ErrorEvent instead — so the handler is watched rather than wrapped in `expect`.
    const errors: unknown[] = [];
    const onError = (event: Event): void => {
      errors.push((event as ErrorEvent).error ?? event);
    };
    window.addEventListener('error', onError);
    try {
      const remove = trigger?.querySelector<HTMLButtonElement>('[aria-label="Remove Alpha"]');
      expect(remove).not.toBeNull();
      act(() => remove!.click());
    } finally {
      window.removeEventListener('error', onError);
    }
    expect(errors).toEqual([]);
    expect(changes).toEqual([['b']]);
  });

  /**
   * `<label for>` cannot address the trigger (a div is not labelable), so a visible label
   * has to reach it through aria-labelledby. The placeholder fallback must step aside, or
   * it would win the accessible-name calculation over the real label text.
   */
  it('names the trigger from aria-labelledby instead of the placeholder', () => {
    render(
      <>
        <span id="employees-label">Employees</span>
        <NegatableMultiSelect
          aria-labelledby="employees-label"
          options={OPTIONS}
          value={[]}
          onValueChange={(): void => {}}
          placeholder="Scroll to see all options"
        />
      </>,
    );
    const trigger = container.querySelector('[role="combobox"]');
    expect(trigger?.getAttribute('aria-labelledby')).toBe('employees-label');
    expect(trigger?.getAttribute('aria-label')).toBeNull();
  });

  /**
   * The popover must be modal. Every consumer sits inside a Radix Dialog, whose RemoveScroll
   * cancels wheel events outside the dialog content — and this popover portals to
   * document.body, which is outside it — so a non-modal popover's option list could not be
   * scrolled at all past its 300px cap. A modal popover pushes its own scroll lock on top,
   * and only the topmost lock acts. `data-scroll-locked` on the body is that lock.
   */
  it('opens a modal popover so the option list stays scrollable inside a dialog', () => {
    render(<NegatableMultiSelect options={OPTIONS} value={[]} onValueChange={(): void => {}} />);
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);

    const trigger = container.querySelector<HTMLElement>('[role="combobox"]');
    act(() => trigger!.click());

    expect(container.ownerDocument.querySelector('[data-slot="command-list"]')).not.toBeNull();
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(true);
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

/**
 * "Select All" / "Select all visible" used to render a permanently unchecked box and only ever
 * add options, so there was no way to clear a whole list in one click.
 */
describe('NegatableMultiSelect select all', () => {
  const state: { value: string[]; excluded: string[] } = { value: [], excluded: [] };

  function Harness({
    negatable = false,
    initialValue = [],
    initialExcluded = [],
  }: {
    negatable?: boolean;
    initialValue?: string[];
    initialExcluded?: string[];
  }): ReactElement {
    const [value, setValue] = useState(initialValue);
    const [excluded, setExcluded] = useState(initialExcluded);
    state.value = value;
    state.excluded = excluded;
    return (
      <NegatableMultiSelect
        options={OPTIONS}
        value={value}
        onValueChange={setValue}
        excludedValue={excluded}
        onExcludedChange={setExcluded}
        negatable={negatable}
      />
    );
  }

  function open(ui: ReactElement = <Harness />): void {
    render(ui);
    act(() => container.querySelector<HTMLElement>('[role="combobox"]')!.click());
  }

  function items(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>('[cmdk-item]')];
  }

  function item(text: string): HTMLElement {
    const found = items().find(candidate => candidate.textContent?.includes(text));
    if (!found) {
      throw new Error(`no item containing "${text}"`);
    }
    return found;
  }

  /** The Radix checkbox's state for the row containing `text`. */
  function checkState(text: string): string | null {
    return item(text).querySelector('[data-slot="checkbox"]')?.getAttribute('data-state') ?? null;
  }

  const SELECT_ALL = '(Select All)';

  function click(text: string): void {
    act(() => item(text).click());
  }

  function type(text: string): void {
    const input = document.querySelector<HTMLInputElement>('[cmdk-input]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  it('checks itself along with every option', () => {
    open();
    expect(checkState(SELECT_ALL)).toBe('unchecked');

    click(SELECT_ALL);
    expect(state.value).toEqual(['a', 'b', 'c']);
    expect(checkState(SELECT_ALL)).toBe('checked');
    for (const label of ['Alpha', 'Bravo', 'Charlie']) {
      expect(checkState(label)).toBe('checked');
    }
  });

  it('unchecks every option when clicked again', () => {
    open();
    click(SELECT_ALL);
    click(SELECT_ALL);

    expect(state.value).toEqual([]);
    expect(state.excluded).toEqual([]);
    expect(checkState(SELECT_ALL)).toBe('unchecked');
    for (const label of ['Alpha', 'Bravo', 'Charlie']) {
      expect(checkState(label)).toBe('unchecked');
    }
  });

  it('unchecks itself when one option is unchecked, and rechecks when it is checked again', () => {
    open();
    click(SELECT_ALL);

    click('Bravo');
    expect(state.value).toEqual(['a', 'c']);
    expect(checkState(SELECT_ALL)).toBe('unchecked');

    click('Bravo');
    expect(checkState(SELECT_ALL)).toBe('checked');
  });

  it('is checked when every option was selected one by one', () => {
    open(<Harness initialValue={['a', 'b', 'c']} />);
    expect(checkState(SELECT_ALL)).toBe('checked');
  });

  it('only toggles the visible options while searching', () => {
    open(<Harness initialValue={['c']} />);
    // Only "Alpha" matches.
    type('al');
    const visibleSelectAll = '(Select all visible)';
    expect(checkState(visibleSelectAll)).toBe('unchecked');

    click(visibleSelectAll);
    expect([...state.value].sort()).toEqual(['a', 'c']);
    expect(checkState(visibleSelectAll)).toBe('checked');

    click(visibleSelectAll);
    // "Charlie" was not visible for "al", so its selection is kept.
    expect(state.value).toEqual(['c']);
  });

  it('treats excluded options as selected in negatable mode, and clears them too', () => {
    open(<Harness negatable initialValue={['a', 'c']} initialExcluded={['b']} />);
    expect(checkState(SELECT_ALL)).toBe('checked');

    click(SELECT_ALL);
    expect(state.value).toEqual([]);
    expect(state.excluded).toEqual([]);
  });
});
